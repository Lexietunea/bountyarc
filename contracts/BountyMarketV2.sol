// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BountyMarketV2
 * @notice Many-to-many onchain bounty marketplace for Arc.
 *
 * On Arc, the native gas token IS USDC (18 decimals in the gas / msg.value view).
 * This contract accepts msg.value for reward staking and pays out with a native
 * transfer — no ERC-20 approve step, one transaction to post a bounty.
 *
 * All reward amounts stored and emitted are in native Arc USDC units (18 decimals).
 */
contract BountyMarketV2 is Ownable, Pausable, ReentrancyGuard {

    // ─── Types ───────────────────────────────────────────────────────────────

    enum BountyStatus { Open, Completed, Refunded, Cancelled }

    enum Category { General, Code, Design, Research, Writing, Data, AITask }

    struct Bounty {
        uint256 id;
        address poster;
        string  title;
        string  description;
        Category category;
        uint256 reward;            // native Arc USDC (18 dec)
        bool    isLargeBounty;     // true when reward > LARGE_BOUNTY_THRESHOLD at creation
        uint256 deadline;          // unix timestamp
        BountyStatus status;
        uint256 winnerSubmissionId;
        uint256 submissionCount;
        uint256 createdAt;
        bool    disputed;
        address disputeInitiator;
    }

    struct Submission {
        uint256 id;
        uint256 bountyId;
        address submitter;
        string  submissionTitle;
        string  submissionDescription;
        string  proofUri;
        uint256 submittedAt;
        bool    isWinner;
    }

    struct Comment {
        uint256 id;
        uint256 bountyId;
        address author;
        string  text;
        uint256 createdAt;
    }

    // ─── State ───────────────────────────────────────────────────────────────

    uint256 public constant MIN_REWARD = 1e16; // $0.01 USDC in 18-decimal native units
    uint256 public constant MAX_FEE_BPS = 1000; // 10% hard cap — owner cannot set above this
    // Large bounty threshold: $500 USDC in 18-decimal native Arc units
    uint256 public constant LARGE_BOUNTY_THRESHOLD = 500e18;

    // Fixed basis-point splits for large bounties (must sum to 10000)
    // 1st=35%, 2nd=25%, 3rd=20%, 4th=12%, 5th=8%
    uint16[5] private LARGE_BOUNTY_SPLITS = [uint16(3500), uint16(2500), uint16(2000), uint16(1200), uint16(800)];

    uint256 public bountyCount;
    uint256 public submissionCount;
    uint256 public commentCount;

    address public arbitrator;
    address public feeRecipient;          // set in constructor to msg.sender (owner)

    uint256 public feeBps = 250;          // 2.5% default, basis points (1 bp = 0.01%)

    mapping(uint256 => Bounty)                          public bounties;
    mapping(uint256 => Submission)                      public submissions;
    mapping(uint256 => Comment)                         public comments;
    mapping(uint256 => uint256[])              private  _bountySubmissions;
    mapping(uint256 => uint256[])              private  _bountyComments;
    mapping(uint256 => mapping(address => uint256)) public submitterToSubmission;
    mapping(address => uint256) public pendingWithdrawals;

    uint256 public totalEscrowed;
    uint256 public totalPendingWithdrawals;
    uint256 public totalFeesCollected;    // lifetime tracking

    // ─── Errors ──────────────────────────────────────────────────────────────

    error BountyNotFound();
    error BountyNotOpen();
    error DeadlineNotPassed();
    error DeadlineTooSoon();
    error DeadlineAlreadyPassed();
    error NotPoster();
    error PosterCannotSubmit();
    error AlreadySubmitted();
    error EmptyProofUri();
    error ZeroReward();
    error InvalidSubmission();
    error TitleTooLong();
    error DescriptionTooLong();
    error HasSubmissions();
    error TransferFailed();

    error FeeTooHigh();
    error ZeroFeeRecipient();

    error RewardTooLow();
    error SubmissionTitleTooLong();
    error SubmissionDescTooLong();
    error EmptyComment();
    error CommentTooLong();
    error NotSubmitter();
    error DisputeAlreadyRaised();
    error NotDisputed();
    error NotArbitrator();
    error NoArbitratorSet();
    error InvalidPayoutSplit();
    error MustSelectFiveWinners(uint256 bountyId);
    error LargeBountyRequiresFiveWinners(uint256 bountyId);
    error LargeBountyInvalidSplits(uint256 bountyId);
    error DuplicateSubmission();
    error CommentNotFound();
    error NothingToWithdraw();
    error CannotRenounceWhilePaused();
    error NoStrandedFunds();
    error DisputeInProgress();
    error GracePeriodActive();
    error ZeroAddress();

    // ─── Events ──────────────────────────────────────────────────────────────

    event BountyCreated(uint256 indexed bountyId, address indexed poster, uint256 reward, uint256 deadline);
    event WorkSubmitted(uint256 indexed bountyId, uint256 indexed submissionId, address indexed submitter, string proofUri);
    event WinnerSelected(uint256 indexed bountyId, uint256 indexed submissionId, address indexed winner, uint256 reward);
    event BountyRefunded(uint256 indexed bountyId, address indexed poster, uint256 reward);
    event BountyCancelled(uint256 indexed bountyId, address indexed poster, uint256 reward);

    event CommentAdded(uint256 indexed bountyId, uint256 indexed commentId, address indexed author, string text);
    event WinnersSelected(uint256 indexed bountyId, uint256[] submissionIds, address[] winners, uint256[] amounts);
    event ArbitratorUpdated(address indexed newArbitrator);
    event DisputeRaised(uint256 indexed bountyId, address indexed initiator);
    event DisputeResolved(uint256 indexed bountyId, address indexed winner, uint256 reward);
    event Withdrawal(address indexed recipient, uint256 amount);
    event FundsRescued(address indexed to, uint256 amount);
    event FeeUpdated(uint256 newFeeBps);
    event FeeRecipientUpdated(address indexed newRecipient);
    event FeeCollected(uint256 indexed bountyId, uint256 feeAmount);

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {
        feeRecipient = msg.sender;
    }

    // ─── Internal helper ─────────────────────────────────────────────────────

    function _safeNativeTransfer(address to, uint256 amount) internal {
        (bool ok,) = payable(to).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    function _selectWinners(
        uint256 bountyId,
        uint256[] memory submissionIds,
        uint256[] memory basisPoints
    ) internal {
        Bounty storage bounty = bounties[bountyId];

        if (bounty.id == 0) revert BountyNotFound();
        if (msg.sender != bounty.poster) revert NotPoster();
        if (bounty.status != BountyStatus.Open) revert BountyNotOpen();

        uint256 len = submissionIds.length;
        if (len == 0 || len != basisPoints.length) revert InvalidPayoutSplit();
        if (!bounty.isLargeBounty && len > 3) revert InvalidPayoutSplit();
        if (bounty.isLargeBounty && len != 5) revert InvalidPayoutSplit();

        uint256 totalBps;
        for (uint256 i = 0; i < len; i++) {
            uint256 sid = submissionIds[i];
            Submission storage s = submissions[sid];
            if (s.bountyId != bountyId || s.submitter == address(0)) revert InvalidSubmission();

            for (uint256 j = i + 1; j < len; j++) {
                if (sid == submissionIds[j]) revert DuplicateSubmission();
            }

            totalBps += basisPoints[i];
        }

        if (totalBps != 10_000) revert InvalidPayoutSplit();

        bounty.status = BountyStatus.Completed;
        bounty.winnerSubmissionId = submissionIds[0];

        uint256 feeAmount;
        uint256 netReward = bounty.reward;
        if (feeBps > 0 && feeRecipient != address(0)) {
            feeAmount = (bounty.reward * feeBps) / 10_000;
            netReward = bounty.reward - feeAmount;

            if (feeAmount > 0) {
                pendingWithdrawals[feeRecipient] += feeAmount;
                totalPendingWithdrawals += feeAmount;
                totalFeesCollected += feeAmount;
                emit FeeCollected(bounty.id, feeAmount);
            }
        }

        uint256[] memory amounts = new uint256[](len);
        address[] memory winners = new address[](len);

        uint256 distributed;
        for (uint256 i = 0; i < len; i++) {
            Submission storage s = submissions[submissionIds[i]];
            s.isWinner = true;
            winners[i] = s.submitter;

            uint256 amount = (netReward * basisPoints[i]) / 10_000;
            amounts[i] = amount;
            distributed += amount;
        }

        uint256 dust = netReward - distributed;
        amounts[0] += dust;

        uint256 totalPaid;
        for (uint256 i = 0; i < len; i++) {
            pendingWithdrawals[winners[i]] += amounts[i];
            totalPaid += amounts[i];
        }

        totalEscrowed -= bounty.reward;
        totalPendingWithdrawals += totalPaid;

        emit WinnersSelected(bountyId, submissionIds, winners, amounts);
        emit WinnerSelected(bountyId, submissionIds[0], winners[0], amounts[0]);
    }

    // ─── Write functions ─────────────────────────────────────────────────────

    /**
     * @notice Post a bounty. Send the reward as msg.value (native Arc USDC, 18 dec).
     */
    function createBounty(
        string calldata title,
        string calldata description,
        Category category,
        uint256 deadline
    ) external payable whenNotPaused nonReentrant returns (uint256 bountyId) {
        if (bytes(title).length == 0 || bytes(title).length > 100)  revert TitleTooLong();
        if (bytes(description).length > 1000)                        revert DescriptionTooLong();
        if (msg.value < MIN_REWARD)                                  revert RewardTooLow();
        if (deadline <= block.timestamp + 1 hours)                   revert DeadlineTooSoon();

        unchecked { bountyCount += 1; }
        bountyId = bountyCount;

        bounties[bountyId] = Bounty({
            id:                  bountyId,
            poster:              msg.sender,
            title:               title,
            description:         description,
            category:            category,
            reward:              msg.value,
            isLargeBounty:       false,
            deadline:            deadline,
            status:              BountyStatus.Open,
            winnerSubmissionId:  0,
            submissionCount:     0,
            createdAt:           block.timestamp,
            disputed:            false,
            disputeInitiator:    address(0)
        });

        if (msg.value > LARGE_BOUNTY_THRESHOLD) {
            bounties[bountyId].isLargeBounty = true;
        }

        totalEscrowed += msg.value;

        emit BountyCreated(bountyId, msg.sender, msg.value, deadline);
    }

    /**
     * @notice Submit work for a bounty.
     */
    function submitWork(
        uint256 bountyId,
        string calldata submissionTitle,
        string calldata submissionDescription,
        string calldata proofUri
    ) external whenNotPaused returns (uint256 submissionId) {
        Bounty storage bounty = bounties[bountyId];

        if (bounty.id == 0)                                                  revert BountyNotFound();
        if (bounty.status != BountyStatus.Open)                              revert BountyNotOpen();
        if (block.timestamp > bounty.deadline)                               revert DeadlineAlreadyPassed();
        if (msg.sender == bounty.poster)                                     revert PosterCannotSubmit();
        if (submitterToSubmission[bountyId][msg.sender] != 0)                revert AlreadySubmitted();
        if (bytes(submissionTitle).length > 100)                             revert SubmissionTitleTooLong();
        if (bytes(submissionDescription).length > 500)                       revert SubmissionDescTooLong();
        if (bytes(proofUri).length == 0)                                     revert EmptyProofUri();

        unchecked {
            submissionCount += 1;
            bounty.submissionCount += 1;
        }
        submissionId = submissionCount;

        submissions[submissionId] = Submission({
            id:                    submissionId,
            bountyId:              bountyId,
            submitter:             msg.sender,
            submissionTitle:       submissionTitle,
            submissionDescription: submissionDescription,
            proofUri:              proofUri,
            submittedAt:           block.timestamp,
            isWinner:              false
        });

        _bountySubmissions[bountyId].push(submissionId);
        submitterToSubmission[bountyId][msg.sender] = submissionId;

        emit WorkSubmitted(bountyId, submissionId, msg.sender, proofUri);
    }

    /**
     * @notice Poster selects one or more winners (up to 3, or 5 with fixed splits for large bounties).
     */
    function selectWinners(
        uint256 bountyId,
        uint256[] calldata submissionIds,
        uint256[] calldata basisPoints
    ) external whenNotPaused nonReentrant {
        if (bounties[bountyId].isLargeBounty) {
            // Must be exactly 5 winners
            if (submissionIds.length != 5) revert LargeBountyRequiresFiveWinners(bountyId);
            // Splits must match the fixed large-bounty splits exactly
            for (uint256 i = 0; i < 5; i++) {
                if (basisPoints[i] != LARGE_BOUNTY_SPLITS[i]) revert LargeBountyInvalidSplits(bountyId);
            }
        }

        _selectWinners(bountyId, submissionIds, basisPoints);
    }

    /**
     * @notice Poster selects a single winner. Reward credited for withdrawal.
     */
    function selectWinner(
        uint256 bountyId,
        uint256 submissionId
    ) external whenNotPaused nonReentrant {
        if (bounties[bountyId].isLargeBounty) revert MustSelectFiveWinners(bountyId);

        uint256[] memory submissionIds = new uint256[](1);
        uint256[] memory basisPoints = new uint256[](1);
        submissionIds[0] = submissionId;
        basisPoints[0] = 10_000;

        _selectWinners(bountyId, submissionIds, basisPoints);
    }

    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        pendingWithdrawals[msg.sender] = 0;
        totalPendingWithdrawals -= amount;
        _safeNativeTransfer(msg.sender, amount);
        emit Withdrawal(msg.sender, amount);
    }

    /**
     * @notice Raise a dispute after deadline if no winner selected.
     */
    function disputeBounty(uint256 bountyId) external whenNotPaused {
        Bounty storage bounty = bounties[bountyId];

        if (bounty.id == 0) revert BountyNotFound();
        if (bounty.status != BountyStatus.Open) revert BountyNotOpen();
        if (block.timestamp <= bounty.deadline) revert DeadlineNotPassed();
        if (bounty.winnerSubmissionId != 0) revert InvalidSubmission();
        if (submitterToSubmission[bountyId][msg.sender] == 0) revert NotSubmitter();
        if (bounty.disputed) revert DisputeAlreadyRaised();

        bounty.disputed = true;
        bounty.disputeInitiator = msg.sender;

        emit DisputeRaised(bountyId, msg.sender);
    }

    /**
     * @notice Arbitrator resolves a dispute by selecting winner or refunding poster.
     * winnerSubmissionId == 0 means refund poster.
     */
    function resolveDispute(uint256 bountyId, uint256 winnerSubmissionId) external whenNotPaused nonReentrant {
        if (arbitrator == address(0)) revert NoArbitratorSet();
        if (msg.sender != arbitrator) revert NotArbitrator();

        Bounty storage bounty = bounties[bountyId];
        if (bounty.id == 0) revert BountyNotFound();
        if (bounty.status != BountyStatus.Open) revert BountyNotOpen();
        if (!bounty.disputed) revert NotDisputed();

        bounty.disputed = false;

        if (winnerSubmissionId == 0) {
            bounty.status = BountyStatus.Refunded;
            pendingWithdrawals[bounty.poster] += bounty.reward;
            totalPendingWithdrawals += bounty.reward;
            totalEscrowed -= bounty.reward;

            emit BountyRefunded(bountyId, bounty.poster, bounty.reward);
            emit DisputeResolved(bountyId, address(0), bounty.reward);
            return;
        }

        // Large bounties (>$500) require exactly 5 winners via selectWinners.
        // Dispute resolution for large bounties is refund-only to preserve that invariant.
        if (bounty.isLargeBounty) revert MustSelectFiveWinners(bountyId);

        Submission storage submission = submissions[winnerSubmissionId];
        if (submission.bountyId != bountyId || submission.submitter == address(0)) revert InvalidSubmission();

        bounty.status = BountyStatus.Completed;
        bounty.winnerSubmissionId = winnerSubmissionId;
        submission.isWinner = true;

        // Apply platform fee (same as _selectWinners)
        uint256 feeAmount = (bounty.reward * feeBps) / 10_000;
        uint256 netReward = bounty.reward - feeAmount;

        if (feeAmount > 0 && feeRecipient != address(0)) {
            pendingWithdrawals[feeRecipient] += feeAmount;
            totalPendingWithdrawals += feeAmount;
            totalFeesCollected += feeAmount;
            emit FeeCollected(bounty.id, feeAmount);
        }

        pendingWithdrawals[submission.submitter] += netReward;
        totalPendingWithdrawals += netReward;
        totalEscrowed -= bounty.reward;

        emit WinnerSelected(bountyId, winnerSubmissionId, submission.submitter, netReward);
        emit DisputeResolved(bountyId, submission.submitter, netReward);
    }

    /**
     * @notice Poster can trigger a refund after the deadline with no winner chosen.
     */
    function refundBounty(uint256 bountyId) external whenNotPaused nonReentrant {
        Bounty storage bounty = bounties[bountyId];

        if (bounty.id == 0)                          revert BountyNotFound();
        if (msg.sender != bounty.poster)             revert NotPoster();
        if (bounty.status != BountyStatus.Open)      revert BountyNotOpen();
        if (block.timestamp <= bounty.deadline)      revert DeadlineNotPassed();
        if (bounty.disputed)                         revert DisputeInProgress();
        if (bounty.submissionCount > 0 && block.timestamp < bounty.deadline + 3 days) revert GracePeriodActive();

        bounty.status = BountyStatus.Refunded;
        pendingWithdrawals[bounty.poster] += bounty.reward;
        totalPendingWithdrawals += bounty.reward;
        totalEscrowed -= bounty.reward;

        emit BountyRefunded(bountyId, bounty.poster, bounty.reward);
    }

    /**
     * @notice Poster can cancel only if no submissions have been made yet.
     */
    function cancelBounty(uint256 bountyId) external whenNotPaused nonReentrant {
        Bounty storage bounty = bounties[bountyId];

        if (bounty.id == 0)                          revert BountyNotFound();
        if (msg.sender != bounty.poster)             revert NotPoster();
        if (bounty.status != BountyStatus.Open)      revert BountyNotOpen();
        if (bounty.submissionCount != 0)             revert HasSubmissions();

        bounty.status = BountyStatus.Cancelled;
        pendingWithdrawals[bounty.poster] += bounty.reward;
        totalPendingWithdrawals += bounty.reward;
        totalEscrowed -= bounty.reward;

        emit BountyCancelled(bountyId, bounty.poster, bounty.reward);
    }

    /**
     * @notice Add an onchain comment to a bounty.
     */
    function addComment(uint256 bountyId, string calldata text)
        external
        whenNotPaused
        returns (uint256 commentId)
    {
        if (bounties[bountyId].id == 0) revert BountyNotFound();

        uint256 textLength = bytes(text).length;
        if (textLength == 0) revert EmptyComment();
        if (textLength > 500) revert CommentTooLong();

        unchecked { commentCount += 1; }
        commentId = commentCount;

        comments[commentId] = Comment({
            id: commentId,
            bountyId: bountyId,
            author: msg.sender,
            text: text,
            createdAt: block.timestamp
        });

        _bountyComments[bountyId].push(commentId);

        emit CommentAdded(bountyId, commentId, msg.sender, text);
    }

    function setArbitrator(address newArbitrator) external onlyOwner {
        if (newArbitrator == address(0)) revert ZeroAddress();
        arbitrator = newArbitrator;
        emit ArbitratorUpdated(newArbitrator);
    }

    function setFeeBps(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        feeBps = newFeeBps;
        emit FeeUpdated(newFeeBps);
    }

    function setFeeRecipient(address newRecipient) external onlyOwner {
        if (newRecipient == address(0)) revert ZeroFeeRecipient();
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(newRecipient);
    }

    // ─── View functions ──────────────────────────────────────────────────────

    function calculateFee(uint256 reward) external view returns (uint256 fee, uint256 net) {
        fee = (reward * feeBps) / 10_000;
        net = reward - fee;
    }

    /// @notice Returns the fixed basis-point splits for large bounties [3500, 2500, 2000, 1200, 800]
    function getLargeBountySplits() external pure returns (uint16[5] memory) {
        return [uint16(3500), uint16(2500), uint16(2000), uint16(1200), uint16(800)];
    }

    /// @notice Returns true if this bounty requires 5 winners
    function isLargeBounty(uint256 bountyId) external view returns (bool) {
        return bounties[bountyId].isLargeBounty;
    }

    function getBountySubmissions(uint256 bountyId) external view returns (uint256[] memory) {
        if (bounties[bountyId].id == 0) revert BountyNotFound();
        return _bountySubmissions[bountyId];
    }

    function getBountyComments(uint256 bountyId) external view returns (uint256[] memory) {
        if (bounties[bountyId].id == 0) revert BountyNotFound();
        return _bountyComments[bountyId];
    }

    function getBountiesByCategory(Category cat) external view returns (uint256[] memory) {
        uint256[] memory tmp = new uint256[](200);
        uint256 count;

        for (uint256 i = 1; i <= bountyCount && count < 200; i++) {
            if (bounties[i].category == cat) {
                tmp[count++] = i;
            }
        }

        uint256[] memory result = new uint256[](count);
        for (uint256 j = 0; j < count; j++) result[j] = tmp[j];
        return result;
    }

    function getBounty(uint256 bountyId) external view returns (Bounty memory) {
        Bounty memory b = bounties[bountyId];
        if (b.id == 0) revert BountyNotFound();
        return b;
    }

    function getSubmission(uint256 submissionId) external view returns (Submission memory) {
        Submission memory s = submissions[submissionId];
        if (s.submitter == address(0)) revert InvalidSubmission();
        return s;
    }

    function getComment(uint256 commentId) external view returns (Comment memory) {
        Comment memory c = comments[commentId];
        if (c.author == address(0)) revert CommentNotFound();
        return c;
    }

    function getActiveBounties() external view returns (uint256[] memory) {
        uint256[] memory tmp = new uint256[](200);
        uint256 count;
        for (uint256 i = 1; i <= bountyCount && count < 200; i++) {
            if (bounties[i].status == BountyStatus.Open) {
                tmp[count++] = i;
            }
        }
        uint256[] memory result = new uint256[](count);
        for (uint256 j = 0; j < count; j++) result[j] = tmp[j];
        return result;
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // Operator responsibility: only call when no open bounties exist.
    function rescueFunds() external onlyOwner whenNotPaused nonReentrant {
        uint256 rescueAmount = address(this).balance - totalEscrowed - totalPendingWithdrawals;
        if (rescueAmount == 0) revert NoStrandedFunds();
        address recipient = owner();
        _safeNativeTransfer(recipient, rescueAmount);
        emit FundsRescued(recipient, rescueAmount);
    }

    function renounceOwnership() public override onlyOwner {
        if (paused()) revert CannotRenounceWhilePaused();
        super.renounceOwnership();
    }

    receive() external payable {}
}
