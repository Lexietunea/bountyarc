// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract CreditScore is Ownable, Pausable {
    enum EventType {
        OnTimePayment,
        LatePayment,
        Default,
        LoanRepaid,
        LoanOpened,
        CreditUtilizationUpdate
    }

    struct CreditEvent {
        address wallet;
        EventType eventType;
        uint64 amountUsdc;
        address reporter;
        uint256 timestamp;
    }

    struct CreditProfile {
        uint16 score;
        uint32 totalEvents;
        uint32 onTimePayments;
        uint32 latePayments;
        uint32 defaults;
        uint32 loansRepaid;
        uint32 loansOpened;
        uint32 lowUtilizationUpdates;
        uint32 highUtilizationUpdates;
        uint64 totalAmountUsdc;
        uint32 lastUpdatedAt;
    }

    uint16 public constant MIN_SCORE = 0;
    uint16 public constant MAX_SCORE = 850;
    uint16 public constant BASE_SCORE = 300;

    uint8 public constant MAX_HISTORY = 50;
    uint32 public constant MAX_ON_TIME_BONUS_EVENTS = 20;

    uint16 public constant LOW_UTILIZATION_BPS = 3000; // <= 30%
    uint16 public constant HIGH_UTILIZATION_BPS = 8000; // > 80%

    mapping(address => CreditProfile) public profiles;
    mapping(address => bool) public reporters;
    mapping(address => CreditEvent[]) private _history;
    mapping(address => uint8) private _historyNextIndex;
    /// @notice Tracks consumed event IDs to prevent replay attacks by malicious reporters.
    mapping(bytes32 => bool) private _consumedEventIds;

    event ScoreUpdated(address indexed wallet, uint16 oldScore, uint16 newScore, EventType eventType);
    event ReporterAdded(address indexed reporter);
    event ReporterRemoved(address indexed reporter);

    error NotReporter();
    error ZeroAddress();
    error InvalidUtilizationBps(uint256 utilizationBps);
    error EventAlreadyConsumed(bytes32 eventId);

    modifier onlyReporter() {
        if (!reporters[msg.sender]) revert NotReporter();
        _;
    }

    constructor() Ownable(msg.sender) {}

    function addReporter(address reporter) external onlyOwner {
        if (reporter == address(0)) revert ZeroAddress();
        reporters[reporter] = true;
        emit ReporterAdded(reporter);
    }

    function removeReporter(address reporter) external onlyOwner {
        if (reporter == address(0)) revert ZeroAddress();
        reporters[reporter] = false;
        emit ReporterRemoved(reporter);
    }

    /// @notice Submit a verified credit event for a wallet.
    /// @param eventId A unique identifier for this event (e.g. keccak256 of tx hash + log index from the source protocol).
    ///                Prevents a reporter from replaying the same event to inflate or tank a score.
    function submitEvent(address wallet, EventType eventType, uint256 amountUsdc, bytes32 eventId)
        external
        onlyReporter
        whenNotPaused
    {
        if (wallet == address(0)) revert ZeroAddress();
        if (_consumedEventIds[eventId]) revert EventAlreadyConsumed(eventId);
        _consumedEventIds[eventId] = true;

        CreditProfile storage profile = profiles[wallet];
        uint16 oldScore = profile.totalEvents == 0 && profile.score == 0 ? BASE_SCORE : profile.score;

        uint64 boundedAmount = _boundToUint64(amountUsdc);

        unchecked {
            profile.totalEvents += 1;
        }

        if (eventType == EventType.OnTimePayment) {
            unchecked {
                profile.onTimePayments += 1;
            }
            _accumulateAmount(profile, boundedAmount);
        } else if (eventType == EventType.LatePayment) {
            unchecked {
                profile.latePayments += 1;
            }
            _accumulateAmount(profile, boundedAmount);
        } else if (eventType == EventType.Default) {
            unchecked {
                profile.defaults += 1;
            }
            _accumulateAmount(profile, boundedAmount);
        } else if (eventType == EventType.LoanRepaid) {
            unchecked {
                profile.loansRepaid += 1;
            }
            _accumulateAmount(profile, boundedAmount);
        } else if (eventType == EventType.LoanOpened) {
            unchecked {
                profile.loansOpened += 1;
            }
            _accumulateAmount(profile, boundedAmount);
        } else {
            if (amountUsdc > 10_000) revert InvalidUtilizationBps(amountUsdc);

            if (amountUsdc <= LOW_UTILIZATION_BPS) {
                unchecked {
                    profile.lowUtilizationUpdates += 1;
                }
            } else if (amountUsdc > HIGH_UTILIZATION_BPS) {
                unchecked {
                    profile.highUtilizationUpdates += 1;
                }
            }
        }

        profile.lastUpdatedAt = uint32(block.timestamp);

        uint16 newScore = _recomputeScore(profile);
        profile.score = newScore;

        _pushHistory(wallet, eventType, boundedAmount);

        emit ScoreUpdated(wallet, oldScore, newScore, eventType);
    }

    function getScore(address wallet) public view returns (uint16) {
        CreditProfile memory profile = profiles[wallet];
        if (profile.totalEvents == 0 && profile.score == 0) {
            return BASE_SCORE;
        }
        return profile.score;
    }

    function getTier(address wallet) external view returns (string memory) {
        uint16 score = getScore(wallet);

        if (score <= 579) return "Poor";
        if (score <= 669) return "Fair";
        if (score <= 739) return "Good";
        if (score <= 799) return "Very Good";
        return "Excellent";
    }

    function getProfile(address wallet) external view returns (CreditProfile memory) {
        CreditProfile memory profile = profiles[wallet];
        if (profile.totalEvents == 0 && profile.score == 0) {
            profile.score = BASE_SCORE;
        }
        return profile;
    }

    /// @notice Returns up to the last 50 credit events (recent history).
    ///         All events are still counted in the score — the ring buffer only affects display.
    function getHistory(address wallet) external view returns (CreditEvent[] memory) {
        CreditEvent[] storage stored = _history[wallet];
        uint256 len = stored.length;
        if (len == 0) {
            return new CreditEvent[](0);
        }

        CreditEvent[] memory ordered = new CreditEvent[](len);

        if (len < MAX_HISTORY) {
            for (uint256 i = 0; i < len; i++) {
                ordered[i] = stored[i];
            }
            return ordered;
        }

        uint256 start = _historyNextIndex[wallet];
        for (uint256 i = 0; i < len; i++) {
            ordered[i] = stored[(start + i) % MAX_HISTORY];
        }

        return ordered;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @dev Override to prevent renouncing ownership while the contract is paused,
    /// which would permanently lock `submitEvent` with no way to unpause.
    function renounceOwnership() public override onlyOwner {
        if (paused()) revert("CreditScore: cannot renounce while paused");
        super.renounceOwnership();
    }

    function _pushHistory(address wallet, EventType eventType, uint64 amountUsdc) internal {
        CreditEvent[] storage walletHistory = _history[wallet];

        CreditEvent memory newEvent = CreditEvent({
            wallet: wallet,
            eventType: eventType,
            amountUsdc: amountUsdc,
            reporter: msg.sender,
            timestamp: block.timestamp
        });

        uint256 len = walletHistory.length;
        if (len < MAX_HISTORY) {
            walletHistory.push(newEvent);
            return;
        }

        uint8 idx = _historyNextIndex[wallet];
        walletHistory[idx] = newEvent;
        _historyNextIndex[wallet] = uint8((idx + 1) % MAX_HISTORY);
    }

    function _recomputeScore(CreditProfile memory profile) internal pure returns (uint16) {
        int256 score = int256(uint256(BASE_SCORE));

        uint32 onTimeEffective = profile.onTimePayments;
        if (onTimeEffective > MAX_ON_TIME_BONUS_EVENTS) {
            onTimeEffective = MAX_ON_TIME_BONUS_EVENTS;
        }

        score += int256(uint256(onTimeEffective) * 15);
        score -= int256(uint256(profile.latePayments) * 40);
        score -= int256(uint256(profile.defaults) * 120);
        score += int256(uint256(profile.loansRepaid) * 30);
        score -= int256(uint256(profile.loansOpened) * 5);
        score += int256(uint256(profile.lowUtilizationUpdates) * 10);
        score -= int256(uint256(profile.highUtilizationUpdates) * 20);

        if (score < int256(uint256(MIN_SCORE))) {
            return MIN_SCORE;
        }
        if (score > int256(uint256(MAX_SCORE))) {
            return MAX_SCORE;
        }
        return uint16(uint256(score));
    }

    function _accumulateAmount(CreditProfile storage profile, uint64 amountUsdc) internal {
        uint64 current = profile.totalAmountUsdc;
        uint64 max = type(uint64).max;

        if (amountUsdc > max - current) {
            profile.totalAmountUsdc = max;
        } else {
            profile.totalAmountUsdc = current + amountUsdc;
        }
    }

    function _boundToUint64(uint256 amountUsdc) internal pure returns (uint64) {
        uint256 max = type(uint64).max;
        if (amountUsdc > max) {
            return type(uint64).max;
        }
        return uint64(amountUsdc);
    }
}
