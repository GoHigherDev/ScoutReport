// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

import {MockSociosStaking} from "../src/mocks/MockSociosStaking.sol";
import {MockFanToken} from "../src/mocks/MockFanToken.sol";

interface DeployVm {
    function envUint(string calldata name) external returns (uint256);
    function addr(uint256 privateKey) external returns (address);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract DeployChatMocks {
    DeployVm private constant vm = DeployVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (MockSociosStaking staking, MockFanToken token18, MockFanToken token6) {
        require(block.chainid == 88882, "Spicy only");
        uint256 key = vm.envUint("SPICY_DEPLOYER_PRIVATE_KEY");
        address owner = vm.addr(key);
        vm.startBroadcast(key);
        staking = new MockSociosStaking(owner);
        token18 = new MockFanToken(owner, "[MOCK FAN TOKEN 18]", "MOCK18", 18);
        token6 = new MockFanToken(owner, "[MOCK FAN TOKEN 6]", "MOCK6", 6);
        vm.stopBroadcast();
    }
}
