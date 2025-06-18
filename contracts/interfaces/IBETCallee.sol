// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBETCallee {
    function betCall(
        address sender,
        uint amount0,
        uint amount1,
        bytes calldata data
    ) external;
}
