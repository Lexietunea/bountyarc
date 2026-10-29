// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BountyMarket
 * @notice Many-to-many onchain bounty marketplace for Arc.
 *
 * On Arc, the native gas token IS USDC (18 decimals in the gas / msg.value view).
 * This contract accepts msg.value for reward staking and pays out with a native
 * transfer — no ERC-20 approve step, one transaction to post a bounty.
 *
 * All reward amounts stored and emitted are in native Arc USDC units (18 decimals).
 */
contract BountyMarket is Ownable, Pausable, ReentrancyGuard {

    // ─── Types ───────────────────────────────────────────────────────────────

    enum BountyStatus { Open, Completed, Refunded, Cancelled }

    struct Bounty {
        uint256 id;
        address poster;
        string  title;
        string  description;
        uint256 reward;            // native Arc USDC (18 dec)
        uint256 deadline;          // unix timestamp
        BountyStatus status;
        uint256 winnerSubmissionId;
        uint256 submissionCount;
        uint256 createdAt;
    }

    struct Submission {
        uint256 id;
        uint256 bountyId;
        address submitter;
        string  proofUri;
        uint256 submittedAt;
        bool    isWinner;
    }

    // ─── State ───────────────────────────────────────────────────────────────

    uint256 public bountyCount;
    uint256 public submissionCount;

    mapping(uint256 => Bounty)                          public bounties;
    mapping(uint256 => Submission)                      public submissions;
    mapping(uint256 => uint256[])              private  _bountySubmissions;
    mapping(uint256 => mapping(address => uint256)) public submitterToSubmission;

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

    // ─── Events ──────────────────────────────────────────────────────────────

    event BountyCreated(uint256 indexed bountyId, address indexed poster, uint256 reward, uint256 deadline);
    event WorkSubmitted(uint256 indexed bountyId, uint256 indexed submissionId, address indexed submitter, string proofUri);
    event WinnerSelected(uint256 indexed bountyId, uint256 indexed submissionId, address indexed winner, uint256 reward);
    event BountyRefunded(uint256 indexed bountyId, address indexed poster, uint256 reward);
    event BountyCancelled(uint256 indexed bountyId, address indexed poster, uint256 reward);

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ─── Internal helper ─────────────────────────────────────────────────────

    function _safeNativeTransfer(address to, uint256 amount) internal {
        (bool ok,) = payable(to).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    // ─── Write functions ─────────────────────────────────────────────────────

    /**
     * @notice Post a bounty. Send the reward as msg.value (native Arc USDC, 18 dec).
     */
    function createBounty(
        string calldata title,
        string calldata description,
        uint256 deadline
    ) external payable whenNotPaused nonReentrant returns (uint256 bountyId) {
        if (bytes(title).length == 0 || bytes(title).length > 100)  revert TitleTooLong();
        if (bytes(description).length > 1000)                        revert DescriptionTooLong();
        if (msg.value == 0)                                          revert ZeroReward();
        if (deadline <= block.timestamp + 1 hours)                   revert DeadlineTooSoon();

        unchecked { bountyCount += 1; }
        bountyId = bountyCount;

        bounties[bountyId] = Bounty({
            id:                  bountyId,
            poster:              msg.sender,
            title:               title,
            description:         description,
            reward:              msg.value,
            deadline:            deadline,
            status:              BountyStatus.Open,
            winnerSubmissionId:  0,
            submissionCount:     0,
            createdAt:           block.timestamp
        });

        emit BountyCreated(bountyId, msg.sender, msg.value, deadline);
    }

    /**
     * @notice Submit work for a bounty.
     */
    function submitWork(
        uint256 bountyId,
        string calldata proofUri
    ) external whenNotPaused returns (uint256 submissionId) {
        Bounty storage bounty = bounties[bountyId];

        if (bounty.id == 0)                                                  revert BountyNotFound();
        if (bounty.status != BountyStatus.Open)                              revert BountyNotOpen();
        if (block.timestamp > bounty.deadline)                               revert DeadlineAlreadyPassed();
        if (msg.sender == bounty.poster)                                     revert PosterCannotSubmit();
        if (submitterToSubmission[bountyId][msg.sender] != 0)                revert AlreadySubmitted();
        if (bytes(proofUri).length == 0)                                     revert EmptyProofUri();

        unchecked {
            submissionCount += 1;
            bounty.submissionCount += 1;
        }
        submissionId = submissionCount;

        submissions[submissionId] = Submission({
            id:          submissionId,
            bountyId:    bountyId,
            submitter:   msg.sender,
            proofUri:    proofUri,
            submittedAt: block.timestamp,
            isWinner:    false
        });

        _bountySubmissions[bountyId].push(submissionId);
        submitterToSubmission[bountyId][msg.sender] = submissionId;

        emit WorkSubmitted(bountyId, submissionId, msg.sender, proofUri);
    }

    /**
     * @notice Poster selects a winner. Reward paid out instantly.
     */
    function selectWinner(
        uint256 bountyId,
        uint256 submissionId
    ) external nonReentrant {
        Bounty storage bounty = bounties[bountyId];

        if (bounty.id == 0)               revert BountyNotFound();
        if (msg.sender != bounty.poster)  revert NotPoster();
        if (bounty.status != BountyStatus.Open) revert BountyNotOpen();

        Submission storage submission = submissions[submissionId];
        if (submission.bountyId != bountyId || submission.submitter == address(0))
            revert InvalidSubmission();

        bounty.status              = BountyStatus.Completed;
        bounty.winnerSubmissionId  = submissionId;
        submission.isWinner        = true;

        _safeNativeTransfer(submission.submitter, bounty.reward);

        emit WinnerSelected(bountyId, submissionId, submission.submitter, bounty.reward);
    }

    /**
     * @notice Anyone can trigger a refund after the deadline with no winner chosen.
     */
    function refundBounty(uint256 bountyId) external nonReentrant {
        Bounty storage bounty = bounties[bountyId];

        if (bounty.id == 0)                          revert BountyNotFound();
        if (bounty.status != BountyStatus.Open)      revert BountyNotOpen();
        if (block.timestamp <= bounty.deadline)      revert DeadlineNotPassed();

        bounty.status = BountyStatus.Refunded;
        _safeNativeTransfer(bounty.poster, bounty.reward);

        emit BountyRefunded(bountyId, bounty.poster, bounty.reward);
    }

    /**
     * @notice Poster can cancel only if no submissions have been made yet.
     */
    function cancelBounty(uint256 bountyId) external nonReentrant {
        Bounty storage bounty = bounties[bountyId];

        if (bounty.id == 0)                          revert BountyNotFound();
        if (msg.sender != bounty.poster)             revert NotPoster();
        if (bounty.status != BountyStatus.Open)      revert BountyNotOpen();
        if (bounty.submissionCount != 0)             revert HasSubmissions();

        bounty.status = BountyStatus.Cancelled;
        _safeNativeTransfer(bounty.poster, bounty.reward);

        emit BountyCancelled(bountyId, bounty.poster, bounty.reward);
    }

    // ─── View functions ──────────────────────────────────────────────────────

    function getBountySubmissions(uint256 bountyId) external view returns (uint256[] memory) {
        if (bounties[bountyId].id == 0) revert BountyNotFound();
        return _bountySubmissions[bountyId];
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

    function renounceOwnership() public override onlyOwner {
        if (paused()) revert("BountyMarket: cannot renounce while paused");
        super.renounceOwnership();
    }

    receive() external payable {}
}
