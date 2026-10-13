// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

/// @dev Test fixtures only: no staking, custody or simulated cooldown accounting.
contract MockSociosStaking {
    struct StakeDataResponse {
        uint256 totalStake;
        uint256 totalUnstakable;
        uint256 totalLocked;
        uint256 totalLockedFlexible;
        uint256 totalClaimable;
        uint256 totalPendingUnstake;
        uint256 totalExemptFromCooldownPeriod;
        uint256[] totalLockedPerEventType;
    }

    address public immutable owner;
    uint256 public unstakePeriod;
    mapping(address => mapping(address => mapping(bool => StakeDataResponse))) private stakeData;

    constructor(address owner_) {
        require(owner_ != address(0), "Zero owner");
        owner = owner_;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Owner only");
        _;
    }

    function setStakeData(address staker, address token, bool perEventType, StakeDataResponse calldata data)
        external
        onlyOwner
    {
        stakeData[staker][token][perEventType] = data;
    }

    function setUnstakePeriod(uint256 seconds_) external onlyOwner {
        unstakePeriod = seconds_;
    }

    function getStakeData(address staker, address token, bool perEventType)
        external
        view
        returns (StakeDataResponse memory)
    {
        return stakeData[staker][token][perEventType];
    }

    // Match the verified ABI's nonpayable signature; clients must use eth_call.
    function getStakeDataLatest(address staker, address token, bool perEventType)
        external
        returns (StakeDataResponse memory)
    {
        return stakeData[staker][token][perEventType];
    }
}
