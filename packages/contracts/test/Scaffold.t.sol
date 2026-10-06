// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

import {Scaffold} from "../src/Scaffold.sol";

contract ScaffoldTest {
    function testScaffoldIsReady() public {
        require(new Scaffold().ready());
    }
}
