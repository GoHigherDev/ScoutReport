// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

import {MockSociosStaking} from "../src/mocks/MockSociosStaking.sol";
import {MockFanToken} from "../src/mocks/MockFanToken.sol";
import {DeployChatMocks} from "../script/DeployChatMocks.s.sol";

interface TestVm {
    function prank(address sender) external;
    function chainId(uint256 chainId_) external;
}

contract ChatMocksTest {
    TestVm private constant vm = TestVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant STAKER = address(1);
    address private constant OTHER = address(2);
    MockSociosStaking private staking;
    MockFanToken private token;

    function setUp() public {
        staking = new MockSociosStaking(address(this));
        token = new MockFanToken(address(this), "[MOCK FAN TOKEN]", "MOCK", 6);
    }

    function fixture() private pure returns (MockSociosStaking.StakeDataResponse memory data) {
        uint256[] memory perType = new uint256[](2);
        perType[0] = 8;
        perType[1] = 9;
        data = MockSociosStaking.StakeDataResponse(1, 2, 3, 4, 5, 6, 7, perType);
    }

    function testExactTupleRoundTripForBothReadersAndFlags() public {
        MockSociosStaking.StakeDataResponse memory data = fixture();
        for (uint256 i; i < 2; i++) {
            bool perEventType = i == 1;
            data.totalStake = i + 10;
            staking.setStakeData(STAKER, address(token), perEventType, data);
            bytes32 expected = keccak256(abi.encode(data));
            require(keccak256(abi.encode(staking.getStakeData(STAKER, address(token), perEventType))) == expected);
            require(keccak256(abi.encode(staking.getStakeDataLatest(STAKER, address(token), perEventType))) == expected);
        }
        require(staking.getStakeData(STAKER, address(token), false).totalStake == 10);
        require(staking.getStakeData(STAKER, address(token), true).totalStake == 11);
    }

    function testUnsetWalletTokenAndFlagReturnZero() public {
        staking.setStakeData(STAKER, address(token), true, fixture());
        MockSociosStaking.StakeDataResponse memory empty;
        empty.totalLockedPerEventType = new uint256[](0);
        bytes32 expected = keccak256(abi.encode(empty));
        require(keccak256(abi.encode(staking.getStakeData(OTHER, address(token), true))) == expected);
        require(keccak256(abi.encode(staking.getStakeData(STAKER, OTHER, true))) == expected);
        require(keccak256(abi.encode(staking.getStakeDataLatest(STAKER, address(token), false))) == expected);
    }

    function testReplacingFixtureClearsDynamicArray() public {
        staking.setStakeData(STAKER, address(token), true, fixture());
        MockSociosStaking.StakeDataResponse memory data = fixture();
        data.totalLockedPerEventType = new uint256[](0);
        staking.setStakeData(STAKER, address(token), true, data);
        require(staking.getStakeData(STAKER, address(token), true).totalLockedPerEventType.length == 0);
    }

    function testOwnerSetsPeriodInSeconds() public {
        require(staking.unstakePeriod() == 0);
        staking.setUnstakePeriod(604800);
        require(staking.unstakePeriod() == 604800);
        staking.setUnstakePeriod(0);
        require(staking.unstakePeriod() == 0);
    }

    function testNonOwnerCannotSetStakeOrPeriodOrMint() public {
        bytes memory data = abi.encodeCall(staking.setStakeData, (STAKER, address(token), false, fixture()));
        vm.prank(OTHER);
        (bool stakeOk,) = address(staking).call(data);
        require(!stakeOk);
        vm.prank(OTHER);
        (bool periodOk,) = address(staking).call(abi.encodeCall(staking.setUnstakePeriod, (1)));
        require(!periodOk);
        vm.prank(OTHER);
        (bool mintOk,) = address(token).call(abi.encodeCall(token.mint, (OTHER, 1)));
        require(!mintOk);
    }

    function testConfigurableDecimalsAndRawBalances() public {
        require(token.decimals() == 6);
        require(new MockFanToken(address(this), "[MOCK FAN TOKEN]", "MOCK", 18).decimals() == 18);
        require(new MockFanToken(address(this), "[MOCK FAN TOKEN]", "MOCK", 0).decimals() == 0);
        token.mint(address(this), 1_500_000);
        require(token.totalSupply() == 1_500_000);
        require(token.transfer(STAKER, 500_000));
        require(token.balanceOf(STAKER) == 500_000);
        require(token.balanceOf(address(this)) == 1_000_000);
        require(token.approve(OTHER, 200_000));
        vm.prank(OTHER);
        require(token.transferFrom(address(this), STAKER, 200_000));
        require(token.allowance(address(this), OTHER) == 0);
        require(token.balanceOf(STAKER) == 700_000);
        require(token.totalSupply() == 1_500_000);
    }

    function testInfiniteAllowanceAndSelfTransfer() public {
        token.mint(address(this), 10);
        require(token.transfer(address(this), 10));
        require(token.balanceOf(address(this)) == 10);
        require(token.approve(OTHER, type(uint256).max));
        vm.prank(OTHER);
        require(token.transferFrom(address(this), STAKER, 10));
        require(token.allowance(address(this), OTHER) == type(uint256).max);
    }

    function testInvalidTransfersAndMintRevert() public {
        token.mint(address(this), 10);
        (bool zeroMint,) = address(token).call(abi.encodeCall(token.mint, (address(0), 1)));
        (bool zeroTransfer,) = address(token).call(abi.encodeCall(token.transfer, (address(0), 1)));
        (bool zeroApproval,) = address(token).call(abi.encodeCall(token.approve, (address(0), 1)));
        (bool excessBalance,) = address(token).call(abi.encodeCall(token.transfer, (STAKER, 11)));
        require(!zeroMint && !zeroTransfer && !zeroApproval && !excessBalance);
        vm.prank(OTHER);
        (bool noAllowance,) = address(token).call(abi.encodeCall(token.transferFrom, (address(this), STAKER, 1)));
        require(!noAllowance);
        require(token.approve(OTHER, 11));
        vm.prank(OTHER);
        (bool excessApprovedBalance,) =
            address(token).call(abi.encodeCall(token.transferFrom, (address(this), STAKER, 11)));
        require(!excessApprovedBalance);
        require(token.allowance(address(this), OTHER) == 11);
        require(token.balanceOf(address(this)) == 10);
    }

    function testZeroOwnersRejected() public {
        try new MockSociosStaking(address(0)) {
            revert("Accepted zero owner");
        } catch {}
        try new MockFanToken(address(0), "[MOCK FAN TOKEN]", "MOCK", 6) {
            revert("Accepted zero owner");
        } catch {}
    }

    function testDeploymentRejectsMainnetBeforeReadingKey() public {
        vm.chainId(88888);
        DeployChatMocks script = new DeployChatMocks();
        (bool ok, bytes memory reason) = address(script).call(abi.encodeCall(script.run, ()));
        require(!ok);
        require(keccak256(reason) == keccak256(abi.encodeWithSignature("Error(string)", "Spicy only")));
    }
}
