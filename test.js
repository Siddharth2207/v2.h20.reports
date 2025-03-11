async function validateHandleIO(currentOrder, inputIOIndex, outputIOIndex, buyAmountFp18, buyOrderRatioFp18){
  const currentDecodedOrder = ethers.utils.defaultAbiCoder.decode([OrderV3], currentOrder.orderBytes)[0];
  
  const orderbookAddress = currentOrder.orderbook.id;

  const takerAddress = ethers.Wallet.createRandom().address

  let context = getContext()
  context[0][0] = takerAddress
  context[0][1] = orderbookAddress

  context[1][0] = currentOrder.orderHash
  context[1][1] = currentOrder.owner
  context[1][2] = takerAddress

  context[2][0] = buyAmountFp18
  context[2][1] = buyOrderRatioFp18

  context[3][0] = currentDecodedOrder.validInputs[inputIOIndex].token.toString()
  context[3][1] = ethers.BigNumber.from(currentDecodedOrder.validInputs[inputIOIndex].decimals.toString()).mul(ONE).toString()
  context[3][2] = currentDecodedOrder.validInputs[inputIOIndex].vaultId.toString()
  context[3][3] = ethers.BigNumber.from(
      currentOrder.inputs.filter((input) => {
          return (
              input.token.address.toLowerCase() === currentDecodedOrder.validInputs[inputIOIndex].token.toLowerCase() &&
              input.token.decimals.toString() === currentDecodedOrder.validInputs[inputIOIndex].decimals.toString() &&
              input.vaultId.toString() === currentDecodedOrder.validInputs[inputIOIndex].vaultId.toString() 
          )
      })[0].balance.toString()
  ).mul(ethers.BigNumber.from('1'+'0'.repeat(18-Number(currentDecodedOrder.validInputs[inputIOIndex].decimals)))).toString()
  context[3][4] = ethers.BigNumber.from(buyOrderRatioFp18).mul(ethers.BigNumber.from(buyAmountFp18)).div(ethers.BigNumber.from(ONE)).toString()

  context[4][0] = currentDecodedOrder.validOutputs[outputIOIndex].token.toString()
  context[4][1] = ethers.BigNumber.from(currentDecodedOrder.validOutputs[outputIOIndex].decimals.toString()).mul(ONE).toString()
  context[4][2] = currentDecodedOrder.validOutputs[outputIOIndex].vaultId.toString()
  context[4][3] = ethers.BigNumber.from(
      currentOrder.outputs.filter((output) => {
          return (
              output.token.address.toLowerCase() === currentDecodedOrder.validOutputs[outputIOIndex].token.toLowerCase() &&
              output.token.decimals.toString() === currentDecodedOrder.validOutputs[outputIOIndex].decimals.toString() &&
              output.vaultId.toString() === currentDecodedOrder.validOutputs[outputIOIndex].vaultId.toString() 
          )
      })[0].balance.toString()
  ).mul(ethers.BigNumber.from('1'+'0'.repeat(18-Number(currentDecodedOrder.validOutputs[outputIOIndex].decimals)))).toString()
  context[4][4] = buyAmountFp18

  const interpreterContract = new ethers.Contract(currentDecodedOrder.evaluable.interpreter, interpreterV3Abi, networkProvider);  

  let validHandleIO = false 
  try{
      await interpreterContract.eval3(
          currentDecodedOrder.evaluable.store,
          ethers.BigNumber.from(qualifyNamespace(currentDecodedOrder.owner,orderbookAddress)).toString(),
          currentDecodedOrder.evaluable.bytecode,
          '1', // Handle IO source index is 1
          context,
          []
      );
      validHandleIO = true
  }catch(e){
    console.log(`HandleIO Eval failed for order ${currentOrder.orderHash} : ${e.reason} `)
  }

  return validHandleIO
}

async function getCombinedOrders(orders, baseToken, quoteToken) {
    let combinedOrders = [];
    
    const quoteRequests = orders.map(async (currentOrder) => {
      const currentDecodedOrder = ethers.utils.defaultAbiCoder.decode([OrderV3], currentOrder.orderBytes)[0];
  
      let isBuyInput = false, isBuyOutput = false, buyInputIndex, buyOutputIndex;
      let isSellInput = false, isSellOutput = false, sellInputIndex, sellOutputIndex;
  
      // Identify Buy Order Input/Output indices
      for (let j = 0; j < currentDecodedOrder.validInputs.length; j++) {
        if (currentDecodedOrder.validInputs[j].token.toLowerCase() === baseToken.toLowerCase()) {
          isBuyInput = true;
          buyInputIndex = j;
        }
        if (currentDecodedOrder.validInputs[j].token.toLowerCase() === quoteToken.toLowerCase()) {
          isSellInput = true;
          sellInputIndex = j;
        }
      }
  
      for (let j = 0; j < currentDecodedOrder.validOutputs.length; j++) {
        if (currentDecodedOrder.validOutputs[j].token.toLowerCase() === quoteToken.toLowerCase()) {
          isBuyOutput = true;
          buyOutputIndex = j;
        }
        if (currentDecodedOrder.validOutputs[j].token.toLowerCase() === baseToken.toLowerCase()) {
          isSellOutput = true;
          sellOutputIndex = j;
        }
      }
  
      const orderbookAddress = currentOrder.orderbook.id;
      const orderBookContract = new ethers.Contract(orderbookAddress, orderbookAbi, networkProvider);
  
      const processOrder = async (side) => {
        try {
          const isBuy = side === "buy";
          const inputIndex = isBuy ? buyInputIndex : sellInputIndex;
          const outputIndex = isBuy ? buyOutputIndex : sellOutputIndex;
  
          const currentOutputVault = currentOrder.outputs.filter((output) => {
            return (
              output.token.address.toLowerCase() === currentDecodedOrder.validOutputs[outputIndex].token.toLowerCase() &&
              output.token.decimals.toString() === currentDecodedOrder.validOutputs[outputIndex].decimals.toString() &&
              output.vaultId.toString() === currentDecodedOrder.validOutputs[outputIndex].vaultId.toString()
            );
          })[0];
  
          const outputTokenSymbol = currentOutputVault.token.symbol.toUpperCase();
          const outputTokenBalance = ethers.utils.formatUnits(
            currentOutputVault.balance.toString(),
            currentOutputVault.token.decimals
          );
  
          const quoteResult = await networkProvider.call({
            to: orderbookAddress,
            from: ethers.Wallet.createRandom().address,
            data: orderBookContract.interface.encodeFunctionData("quote", [
              {
                order: currentDecodedOrder,
                inputIOIndex: inputIndex,
                outputIOIndex: outputIndex,
                signedContext: [],
              },
            ]),
          });
  
          const decodedQuote = ethers.utils.defaultAbiCoder.decode(["bool", "uint256", "uint256"], quoteResult);
          const amountFp18 = decodedQuote[1].toString();
          const orderRatioFp18 = decodedQuote[2].toString();
          const amount = decodedQuote[1] / 1e18;
          const orderRatio = decodedQuote[2] / 1e18;
  
          const isHandleIOValid = await validateHandleIO(
            currentOrder,
            inputIndex,
            outputIndex,
            amountFp18,
            orderRatioFp18
          );
  
          if (isHandleIOValid) {
            combinedOrders.push({
              orderHash: currentOrder.orderHash,
              side: side,
              ioRatio: orderRatio,
              outputAmount: amount,
              inputAmount: orderRatio * amount,
              outputTokenSymbol,
              outputTokenBalance,
            });
          }
        } catch (error) {
          console.log(`Error processing ${side} order: `, currentOrder.orderHash, error);
        }
      };
  
      // Concurrently process buy and sell orders where applicable
      const promises = [];
      if (isBuyInput && isBuyOutput) promises.push(processOrder("buy"));
      if (isSellInput && isSellOutput) promises.push(processOrder("sell"));
  
      await Promise.all(promises);
    });
  
    // Wait for all requests to finish
    await Promise.all(quoteRequests);
  
    return combinedOrders.filter((order) => order.outputAmount > 0);
  }