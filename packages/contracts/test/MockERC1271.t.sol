// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

import {MockERC1271} from "./utils/MockERC1271.sol";

interface SignatureVm {
    function addr(uint256 key) external returns (address);
    function sign(uint256 key, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
}

contract MockERC1271Test {
    SignatureVm private constant vm = SignatureVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function testOwnerSignatureAndTamperedHash() public {
        uint256 testKey = uint256(keccak256(abi.encode(block.timestamp, address(this))));
        MockERC1271 wallet = new MockERC1271(vm.addr(testKey));
        bytes32 hash = keccak256("SIWE test digest");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(testKey, hash);
        bytes memory signature = abi.encodePacked(r, s, v);
        require(wallet.isValidSignature(hash, signature) == 0x1626ba7e);
        require(wallet.isValidSignature(keccak256("tampered"), signature) == 0xffffffff);
        require(wallet.isValidSignature(hash, hex"abcd") == 0xffffffff);
    }
}
