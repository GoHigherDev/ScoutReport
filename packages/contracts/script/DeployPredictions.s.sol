// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

import {ScoutReportPredictions} from "../src/ScoutReportPredictions.sol";

interface PredictionsDeployVm {
    function envUint(string calldata name) external returns (uint256);
    function addr(uint256 privateKey) external returns (address);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract DeployPredictions {
    PredictionsDeployVm private constant vm =
        PredictionsDeployVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (ScoutReportPredictions predictions) {
        require(block.chainid == 88882, "Spicy only");
        uint256 key = vm.envUint("SPICY_DEPLOYER_PRIVATE_KEY");
        address admin = vm.addr(key);
        vm.startBroadcast(key);
        predictions = new ScoutReportPredictions(admin);
        vm.stopBroadcast();
    }
}
