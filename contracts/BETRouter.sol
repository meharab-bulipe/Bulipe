// // SPDX-License-Identifier: MIT
// pragma solidity ^0.8.24;

// import './interfaces/IUniswapV2Router02.sol';
// import './interfaces/IUniswapV2Factory.sol';
// import './interfaces/IERC20Permit.sol';
// import './interfaces/IUniswapV2Pair.sol';
// import './libraries/UniswapV2Library.sol';
// import './libraries/TransferHelper.sol';

// import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
// import "@openzeppelin/contracts/utils/math/Math.sol";

// interface IWETH {
//     function deposit() external payable;
//     function transfer(address to, uint value) external returns (bool);
//     function withdraw(uint) external;
// }

// contract BETRouter is IBETRouter02 {
//     using SafeERC20 for IERC20;

//     address public immutable override factory;
//     address public immutable override WETH;

//     modifier ensure(uint deadline) {
//         require(deadline >= block.timestamp, 'UniswapV2Router: EXPIRED');
//         _;
//     }

//     constructor(address _factory, address _WETH) {
//         factory = _factory;
//         WETH = _WETH;
//     }

//     receive() external payable {
//         require(msg.sender == WETH, 'UniswapV2Router: NOT_WETH');
//     }

//     // ========== ADD LIQUIDITY ==========

//     function _addLiquidity(
//         address tokenA,
//         address tokenB,
//         uint amountADesired,
//         uint amountBDesired,
//         uint amountAMin,
//         uint amountBMin
//     ) internal returns (uint amountA, uint amountB) {
//         if (IUniswapV2Factory(factory).getPair(tokenA, tokenB) == address(0)) {
//             IUniswapV2Factory(factory).createPair(tokenA, tokenB);
//         }
//         (uint reserveA, uint reserveB) = UniswapV2Library.getReserves(factory, tokenA, tokenB);
//         if (reserveA == 0 && reserveB == 0) {
//             (amountA, amountB) = (amountADesired, amountBDesired);
//         } else {
//             uint amountBOptimal = UniswapV2Library.quote(amountADesired, reserveA, reserveB);
//             if (amountBOptimal <= amountBDesired) {
//                 require(amountBOptimal >= amountBMin, 'UniswapV2Router: INSUFFICIENT_B_AMOUNT');
//                 (amountA, amountB) = (amountADesired, amountBOptimal);
//             } else {
//                 uint amountAOptimal = UniswapV2Library.quote(amountBDesired, reserveB, reserveA);
//                 assert(amountAOptimal <= amountADesired);
//                 require(amountAOptimal >= amountAMin, 'UniswapV2Router: INSUFFICIENT_A_AMOUNT');
//                 (amountA, amountB) = (amountAOptimal, amountBDesired);
//             }
//         }
//     }

//     function addLiquidity(
//         address tokenA,
//         address tokenB,
//         uint amountADesired,
//         uint amountBDesired,
//         uint amountAMin,
//         uint amountBMin,
//         address to,
//         uint deadline
//     ) external override ensure(deadline)
//         returns (uint amountA, uint amountB, uint liquidity)
//     {
//         (amountA, amountB) = _addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin);
//         address pair = UniswapV2Library.pairFor(factory, tokenA, tokenB);
//         IERC20(tokenA).safeTransferFrom(msg.sender, pair, amountA);
//         IERC20(tokenB).safeTransferFrom(msg.sender, pair, amountB);
//         liquidity = IUniswapV2Pair(pair).mint(to);
//     }

//     function addLiquidityETH(
//         address token,
//         uint amountTokenDesired,
//         uint amountTokenMin,
//         uint amountETHMin,
//         address to,
//         uint deadline
//     ) external override payable ensure(deadline)
//         returns (uint amountToken, uint amountETH, uint liquidity)
//     {
//         (amountToken, amountETH) = _addLiquidity(token, WETH, amountTokenDesired, msg.value, amountTokenMin, amountETHMin);
//         address pair = UniswapV2Library.pairFor(factory, token, WETH);
//         IERC20(token).safeTransferFrom(msg.sender, pair, amountToken);
//         IWETH(WETH).deposit{value: amountETH}();
//         assert(IWETH(WETH).transfer(pair, amountETH));
//         liquidity = IUniswapV2Pair(pair).mint(to);
//         if (msg.value > amountETH) {
//             (bool success,) = msg.sender.call{value: msg.value - amountETH}("");
//             require(success, 'UniswapV2Router: REFUND_FAILED');
//         }
//     }

//     // ========== REMOVE LIQUIDITY ==========

//     function removeLiquidity(
//         address tokenA,
//         address tokenB,
//         uint liquidity,
//         uint amountAMin,
//         uint amountBMin,
//         address to,
//         uint deadline
//     ) external override ensure(deadline) returns (uint amountA, uint amountB) {
//         address pair = UniswapV2Library.pairFor(factory, tokenA, tokenB);
//         IERC20(pair).safeTransferFrom(msg.sender, pair, liquidity);
//         (uint amount0, uint amount1) = IUniswapV2Pair(pair).burn(to);
//         (address token0,) = UniswapV2Library.sortTokens(tokenA, tokenB);
//         (amountA, amountB) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);
//         require(amountA >= amountAMin, 'UniswapV2Router: INSUFFICIENT_A_AMOUNT');
//         require(amountB >= amountBMin, 'UniswapV2Router: INSUFFICIENT_B_AMOUNT');
//     }

//     function removeLiquidityETH(
//         address token,
//         uint liquidity,
//         uint amountTokenMin,
//         uint amountETHMin,
//         address to,
//         uint deadline
//     ) public override ensure(deadline) returns (uint amountToken, uint amountETH) {
//         (amountToken, amountETH) = removeLiquidity(
//             token,
//             WETH,
//             liquidity,
//             amountTokenMin,
//             amountETHMin,
//             address(this),
//             deadline
//         );
//         IERC20(token).safeTransfer(to, amountToken);
//         IWETH(WETH).withdraw(amountETH);
//         (bool success,) = to.call{value: amountETH}("");
//         require(success, 'UniswapV2Router: ETH_TRANSFER_FAILED');
//     }

//     function removeLiquidityETHSupportingFeeOnTransferTokens(
//         address token,
//         uint liquidity,
//         uint amountTokenMin,
//         uint amountETHMin,
//         address to,
//         uint deadline
//     ) public override ensure(deadline) returns (uint amountETH) {
//         address pair = UniswapV2Library.pairFor(factory, token, WETH);
//         IERC20(pair).safeTransferFrom(msg.sender, pair, liquidity);
//         (uint amount0, uint amount1) = IUniswapV2Pair(pair).burn(address(this));
//         (address token0,) = UniswapV2Library.sortTokens(token, WETH);
//         (uint amountToken,) = token == token0 ? (amount0, amount1) : (amount1, amount0);
//         require(amountToken >= amountTokenMin, 'UniswapV2Router: INSUFFICIENT_TOKEN_AMOUNT');
//         IERC20(token).safeTransfer(to, amountToken);
//         IWETH(WETH).withdraw(amount1);
//         amountETH = amount1;
//         require(amountETH >= amountETHMin, 'UniswapV2Router: INSUFFICIENT_ETH_AMOUNT');
//         (bool success,) = to.call{value: amountETH}("");
//         require(success, 'UniswapV2Router: ETH_TRANSFER_FAILED');
//     }

//     // ... Add the swap functions next
// }





pragma solidity ^0.8.24;

import './interfaces/IBETFactory.sol';
import './libraries/TransferHelper.sol';

import './interfaces/IBETRouter02.sol';
import './libraries/BETLibrary.sol';
import './interfaces/IERC20.sol';
import './interfaces/IWETH.sol';

contract BETRouter is IBETRouter02 {
    address public immutable override factory;
    address public immutable override WETH;

    modifier ensure(uint deadline) {
        require(deadline >= block.timestamp, 'BETRouter: EXPIRED');
        _;
    }

    constructor(address _factory, address _WETH) {
        factory = _factory;
        WETH = _WETH;
    }

    receive() external payable {
        require(msg.sender == WETH, 'BETRouter: INVALID_SENDER');
    }

    // **** ADD LIQUIDITY ****
    function _addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin
    ) internal virtual returns (uint amountA, uint amountB) {
        // create the pair if it doesn't exist yet
        if (IBETFactory(factory).getPair(tokenA, tokenB) == address(0)) {
            IBETFactory(factory).createPair(tokenA, tokenB);
        }
        (uint reserveA, uint reserveB) = BETLibrary.getReserves(factory, tokenA, tokenB);
        if (reserveA == 0 && reserveB == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            uint amountBOptimal = BETLibrary.quote(amountADesired, reserveA, reserveB);
            if (amountBOptimal <= amountBDesired) {
                require(amountBOptimal >= amountBMin, 'BETRouter: INSUFFICIENT_B_AMOUNT');
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint amountAOptimal = BETLibrary.quote(amountBDesired, reserveB, reserveA);
                require(amountAOptimal <= amountADesired, 'BETRouter: EXCESSIVE_A_AMOUNT');
                require(amountAOptimal >= amountAMin, 'BETRouter: INSUFFICIENT_A_AMOUNT');
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }
    }

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external virtual override ensure(deadline) returns (uint amountA, uint amountB, uint liquidity) {
        (amountA, amountB) = _addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin);
        address pair = BETLibrary.pairFor(factory, tokenA, tokenB);
        TransferHelper.safeTransferFrom(tokenA, msg.sender, pair, amountA);
        TransferHelper.safeTransferFrom(tokenB, msg.sender, pair, amountB);
        liquidity = IBETPair(pair).mint(to);
    }

    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external virtual override payable ensure(deadline) returns (uint amountToken, uint amountETH, uint liquidity) {
        (amountToken, amountETH) = _addLiquidity(
            token,
            WETH,
            amountTokenDesired,
            msg.value,
            amountTokenMin,
            amountETHMin
        );
        address pair = BETLibrary.pairFor(factory, token, WETH);
        TransferHelper.safeTransferFrom(token, msg.sender, pair, amountToken);
        IWETH(WETH).deposit{value: amountETH}();
        require(IWETH(WETH).transfer(pair, amountETH), 'BETRouter: WETH_TRANSFER_FAILED');
        liquidity = IBETPair(pair).mint(to);

        if (msg.value > amountETH) {
            TransferHelper.safeTransferETH(msg.sender, msg.value - amountETH);
        }
    }

    // **** REMOVE LIQUIDITY ****
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) public virtual override ensure(deadline) returns (uint amountA, uint amountB) {
        address pair = BETLibrary.pairFor(factory, tokenA, tokenB);
        IBETPair(pair).transferFrom(msg.sender, pair, liquidity); // send liquidity to pair
        (uint amount0, uint amount1) = IBETPair(pair).burn(to);
        (address token0,) = BETLibrary.sortTokens(tokenA, tokenB);
        (amountA, amountB) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);
        require(amountA >= amountAMin, "BETRouter: INSUFFICIENT_A_AMOUNT");
        require(amountB >= amountBMin, "BETRouter: INSUFFICIENT_B_AMOUNT");
    }

    function removeLiquidityETH(
        address token,
        uint liquidity,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) public virtual override ensure(deadline) returns (uint amountToken, uint amountETH) {
        (amountToken, amountETH) = removeLiquidity(
            token,
            WETH,
            liquidity,
            amountTokenMin,
            amountETHMin,
            address(this),
            deadline
        );
        TransferHelper.safeTransfer(token, to, amountToken);
        IWETH(WETH).withdraw(amountETH);
        TransferHelper.safeTransferETH(to, amountETH);
    }

    function removeLiquidityWithPermit(
        address tokenA,
        address tokenB,
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline,
        bool approveMax,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external virtual override returns (uint amountA, uint amountB) {
        address pair = BETLibrary.pairFor(factory, tokenA, tokenB);
        uint value = approveMax ? type(uint).max : liquidity;
        IBETPair(pair).permit(msg.sender, address(this), value, deadline, v, r, s);
        (amountA, amountB) = removeLiquidity(tokenA, tokenB, liquidity, amountAMin, amountBMin, to, deadline);
    }

    function removeLiquidityETHWithPermit(
        address token,
        uint liquidity,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline,
        bool approveMax,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external virtual override returns (uint amountToken, uint amountETH) {
        address pair = BETLibrary.pairFor(factory, token, WETH);
        uint value = approveMax ? type(uint).max : liquidity;
        IBETPair(pair).permit(msg.sender, address(this), value, deadline, v, r, s);
        (amountToken, amountETH) = removeLiquidityETH(token, liquidity, amountTokenMin, amountETHMin, to, deadline);
    }

    // **** REMOVE LIQUIDITY (supporting fee-on-transfer tokens) ****
    function removeLiquidityETHSupportingFeeOnTransferTokens(
        address token,
        uint liquidity,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) public virtual override ensure(deadline) returns (uint amountETH) {
        (, amountETH) = removeLiquidity(
            token,
            WETH,
            liquidity,
            amountTokenMin,
            amountETHMin,
            address(this),
            deadline
        );
        TransferHelper.safeTransfer(token, to, IERC20(token).balanceOf(address(this)));
        IWETH(WETH).withdraw(amountETH);
        TransferHelper.safeTransferETH(to, amountETH);
    }

    function removeLiquidityETHWithPermitSupportingFeeOnTransferTokens(
        address token,
        uint liquidity,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline,
        bool approveMax,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external virtual override ensure(deadline) returns (uint amountETH) {
        address pair = BETLibrary.pairFor(factory, token, WETH);
        uint value = approveMax ? type(uint).max : liquidity;
        IBETPair(pair).permit(msg.sender, address(this), value, deadline, v, r, s);
        amountETH = removeLiquidityETHSupportingFeeOnTransferTokens(
            token, liquidity, amountTokenMin, amountETHMin, to, deadline
        );
    }

        // **** SWAP ****
    // requires the initial amount to have already been sent to the first pair
    function _swap(uint[] memory amounts, address[] memory path, address _to) internal virtual {
        for (uint i = 0; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            (address token0,) = BETLibrary.sortTokens(input, output);
            uint amountOut = amounts[i + 1];
            (uint amount0Out, uint amount1Out) = input == token0 ? (uint(0), amountOut) : (amountOut, uint(0));
            address to = i < path.length - 2 ? BETLibrary.pairFor(factory, output, path[i + 2]) : _to;
            IBETPair(BETLibrary.pairFor(factory, input, output)).swap(
                amount0Out, amount1Out, to, new bytes(0)
            );
        }
    }

    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external virtual override ensure(deadline) returns (uint[] memory amounts) {
        amounts = BETLibrary.getAmountsOut(factory, amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "BETRouter: INSUFFICIENT_OUTPUT_AMOUNT");
        TransferHelper.safeTransferFrom(
            path[0], msg.sender, BETLibrary.pairFor(factory, path[0], path[1]), amounts[0]
        );
        _swap(amounts, path, to);
    }

    function swapTokensForExactTokens(
        uint amountOut,
        uint amountInMax,
        address[] calldata path,
        address to,
        uint deadline
    ) external virtual override ensure(deadline) returns (uint[] memory amounts) {
        amounts = BETLibrary.getAmountsIn(factory, amountOut, path);
        require(amounts[0] <= amountInMax, "BETRouter: EXCESSIVE_INPUT_AMOUNT");
        TransferHelper.safeTransferFrom(
            path[0], msg.sender, BETLibrary.pairFor(factory, path[0], path[1]), amounts[0]
        );
        _swap(amounts, path, to);
    }

    function swapExactETHForTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable virtual override ensure(deadline) returns (uint[] memory amounts) {
        require(path[0] == WETH, "BETRouter: INVALID_PATH");
        amounts = BETLibrary.getAmountsOut(factory, msg.value, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "BETRouter: INSUFFICIENT_OUTPUT_AMOUNT");
        IWETH(WETH).deposit{value: amounts[0]}();
        assert(IWETH(WETH).transfer(BETLibrary.pairFor(factory, path[0], path[1]), amounts[0]));
        _swap(amounts, path, to);
    }

    function swapTokensForExactETH(
        uint amountOut,
        uint amountInMax,
        address[] calldata path,
        address to,
        uint deadline
    ) external virtual override ensure(deadline) returns (uint[] memory amounts) {
        require(path[path.length - 1] == WETH, "BETRouter: INVALID_PATH");
        amounts = BETLibrary.getAmountsIn(factory, amountOut, path);
        require(amounts[0] <= amountInMax, "BETRouter: EXCESSIVE_INPUT_AMOUNT");
        TransferHelper.safeTransferFrom(
            path[0], msg.sender, BETLibrary.pairFor(factory, path[0], path[1]), amounts[0]
        );
        _swap(amounts, path, address(this));
        IWETH(WETH).withdraw(amounts[amounts.length - 1]);
        TransferHelper.safeTransferETH(to, amounts[amounts.length - 1]);
    }

    function swapExactTokensForETH(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external virtual override ensure(deadline) returns (uint[] memory amounts) {
        require(path[path.length - 1] == WETH, "BETRouter: INVALID_PATH");
        amounts = BETLibrary.getAmountsOut(factory, amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "BETRouter: INSUFFICIENT_OUTPUT_AMOUNT");
        TransferHelper.safeTransferFrom(
            path[0], msg.sender, BETLibrary.pairFor(factory, path[0], path[1]), amounts[0]
        );
        _swap(amounts, path, address(this));
        IWETH(WETH).withdraw(amounts[amounts.length - 1]);
        TransferHelper.safeTransferETH(to, amounts[amounts.length - 1]);
    }

    function swapETHForExactTokens(
        uint amountOut,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable virtual override ensure(deadline) returns (uint[] memory amounts) {
        require(path[0] == WETH, "BETRouter: INVALID_PATH");
        amounts = BETLibrary.getAmountsIn(factory, amountOut, path);
        require(amounts[0] <= msg.value, "BETRouter: EXCESSIVE_INPUT_AMOUNT");
        IWETH(WETH).deposit{value: amounts[0]}();
        assert(IWETH(WETH).transfer(BETLibrary.pairFor(factory, path[0], path[1]), amounts[0]));
        _swap(amounts, path, to);
        if (msg.value > amounts[0]) {
            TransferHelper.safeTransferETH(msg.sender, msg.value - amounts[0]);
        }
    }

    // *** SWAP (supporting fee-on-transfer tokens) ***
    // requires the initial amount to have already been sent to the first pair
    function _swapSupportingFeeOnTransferTokens(address[] memory path, address _to) internal virtual {
        for (uint i = 0; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            (address token0,) = BETLibrary.sortTokens(input, output);
            IBETPair pair = IBETPair(BETLibrary.pairFor(factory, input, output));
            uint amountInput;
            uint amountOutput;
            { // scope to avoid stack too deep errors
                (uint reserve0, uint reserve1,) = pair.getReserves();
                (uint reserveInput, uint reserveOutput) = input == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
                amountInput = IERC20(input).balanceOf(address(pair)) - reserveInput;
                amountOutput = BETLibrary.getAmountOut(amountInput, reserveInput, reserveOutput);
            }

            (uint amount0Out, uint amount1Out) = input == token0 
                ? (uint(0), amountOutput) 
                : (amountOutput, uint(0));

            address to = i < path.length - 2 
                ? BETLibrary.pairFor(factory, output, path[i + 2]) 
                : _to;

            pair.swap(amount0Out, amount1Out, to, new bytes(0));
        }
    }

    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external virtual override ensure(deadline) {
        TransferHelper.safeTransferFrom(
            path[0], msg.sender, BETLibrary.pairFor(factory, path[0], path[1]), amountIn
        );

        uint balanceBefore = IERC20(path[path.length - 1]).balanceOf(to);
        _swapSupportingFeeOnTransferTokens(path, to);
        uint balanceAfter = IERC20(path[path.length - 1]).balanceOf(to);

        require(
            balanceAfter - balanceBefore >= amountOutMin,
            "BETRouter: INSUFFICIENT_OUTPUT_AMOUNT"
        );
    }

    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external virtual override payable ensure(deadline) {
        require(path[0] == WETH, "BETRouter: INVALID_PATH");

        uint amountIn = msg.value;
        IWETH(WETH).deposit{value: amountIn}();
        assert(IWETH(WETH).transfer(BETLibrary.pairFor(factory, path[0], path[1]), amountIn));

        uint balanceBefore = IERC20(path[path.length - 1]).balanceOf(to);
        _swapSupportingFeeOnTransferTokens(path, to);
        uint balanceAfter = IERC20(path[path.length - 1]).balanceOf(to);

        require(
            balanceAfter - balanceBefore >= amountOutMin,
            "BETRouter: INSUFFICIENT_OUTPUT_AMOUNT"
        );
    }

    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external virtual override ensure(deadline) {
        require(path[path.length - 1] == WETH, "BETRouter: INVALID_PATH");

        TransferHelper.safeTransferFrom(
            path[0], msg.sender, BETLibrary.pairFor(factory, path[0], path[1]), amountIn
        );

        _swapSupportingFeeOnTransferTokens(path, address(this));

        uint amountOut = IERC20(WETH).balanceOf(address(this));
        require(amountOut >= amountOutMin, "BETRouter: INSUFFICIENT_OUTPUT_AMOUNT");

        IWETH(WETH).withdraw(amountOut);
        TransferHelper.safeTransferETH(to, amountOut);
    }

    // **** LIBRARY FUNCTIONS ****

    /// @notice Given some amount of an asset and pair reserves, returns an equivalent amount of the other asset
    function quote(
        uint amountA,
        uint reserveA,
        uint reserveB
    ) public pure override returns (uint amountB) {
        return BETLibrary.quote(amountA, reserveA, reserveB);
    }

    /// @notice Given an input amount of an asset and pair reserves, returns the maximum output amount of the other asset
    function getAmountOut(
        uint amountIn,
        uint reserveIn,
        uint reserveOut
    ) public pure override returns (uint amountOut) {
        return BETLibrary.getAmountOut(amountIn, reserveIn, reserveOut);
    }

    /// @notice Returns a required input amount of the other asset given an output amount and pair reserves
    function getAmountIn(
        uint amountOut,
        uint reserveIn,
        uint reserveOut
    ) public pure override returns (uint amountIn) {
        return BETLibrary.getAmountIn(amountOut, reserveIn, reserveOut);
    }

    /// @notice Given an input amount of an asset and token path, returns maximum output amounts of each token
    function getAmountsOut(
        uint amountIn,
        address[] memory path
    ) public view override returns (uint[] memory amounts) {
        return BETLibrary.getAmountsOut(factory, amountIn, path);
    }

    /// @notice Given an output amount of an asset and token path, returns required input amounts of each token
    function getAmountsIn(
        uint amountOut,
        address[] memory path
    ) public view override returns (uint[] memory amounts) {
        return BETLibrary.getAmountsIn(factory, amountOut, path);
    }
}