import { RainSolverLog } from "./types";

/** @enum {Record<number, string>} RainSolver HyperDX service names per chain */
const HDXServices: Record<number, string> = {
    1: 'digiocean-eth-bot',
    14: 'digiocean-flare-bot',
    56: 'digiocean-bsc-bot',
    137: 'digiocean-polygon-bot',
    8453: 'digiocean-base-new-test-bot',
    42161: 'digiocean-arbitrum-bot',
  };
  
  /**
   * Query rain solver logs for the given order hash in past number of minutes.
   * @param {number} chainId - The chain id of the order
   * @param {string} orderHash - The order hash
   * @param {number} endTime - The end timestamp in millis, default is "now" if omitted
   * @param {number} duration - Timespan of logs in minutes before endTime, default is 5 if omitted
   * @returns {Promise<RainSolverLog[]>}
   */
  export async function queryRainSolverByOrder(
    chainId: number,
    orderHash: string,
    endTime: number = Date.now(),
    duration: number = 5,
  ): Promise<RainSolverLog[]> {
    if (!HDXServices[chainId]) {
      return [];
    }
    const hash = orderHash.toLowerCase();
    const startTime = endTime - duration * 60_000;
    const format = {
      dataSource: 'events',
      aggFn: 'count',
    };
  
    // build query details
    const requestDetails = [
      [
        {
          ...format,
          where: `service:"${HDXServices[chainId]}" order_ -*routeProcessor.* ${hash}`,
          groupBy: ['span_id', 'otel.status_description', 'details.pair'],
        },
      ],
      [
        {
          ...format,
          where: `service:"${HDXServices[chainId]}" order_ routeProcessor.route ${hash}`,
          groupBy: ['span_id', 'details.routeProcessor.route', 'details.pair'],
        },
      ],
      [
        {
          ...format,
          where: `service:"${HDXServices[chainId]}" order_ foundOpp:true ${hash}`,
          groupBy: ['span_id', 'otel.status_description', 'details.pair', 'details.txUrl'],
        },
      ],
      [
        {
          ...format,
          where: `service:"${HDXServices[chainId]}" order_ full -partial ${hash}`,
          groupBy: [
            'span_id',
            'otel.status_description',
            'details.pair',
            'details.quote',
            'details.routeProcessor.full.marketPrice',
            'details.routeProcessor.full.error',
            'details.routeProcessor.full.route',
          ],
        },
      ],
      [
        {
          ...format,
          where: `service:"${HDXServices[chainId]}" order_ partial ${hash}`,
          groupBy: [
            'span_id',
            'details.pair',
            'details.quote',
            'details.routeProcessor.full.marketPrice',
            'details.routeProcessor.full.error',
            'details.routeProcessor.full.route',
            'details.routeProcessor.partial.amountIn',
            'details.routeProcessor.partial.marketPrice',
            'details.routeProcessor.partial.error',
            'details.routeProcessor.partial.route',
          ],
        },
      ],
    ].map((series) => ({
      series,
      endTime,
      startTime,
      granularity: '30 second',
      seriesReturnType: 'column',
    }));
  
    // concurrently fetch solver logs for each request format
    const responses = await Promise.allSettled(
      requestDetails.map(async (requestBody) => {
        const response = await fetch('/api/proxy', {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.REACT_APP_HYPERDX_API_KEY}`,
          },
        });
        const result = await response.json();
        if ('data' in result) return result.data;
        else return Promise.reject(result);
      }),
    );
  
    // parse responses into specified types
    /** @type {RainSolverLog[]} */
    const result = [];
    for (const res of responses) {
      if (res.status === 'fulfilled') {
        for (const log of res.value) {
          if (log?.group?.length) {
            if (log.group.length === 3) {
              result.push({
                spanId: log.group[0],
                status: log.group[1] === 'no-way' ? 'no route' : log.group[1],
                pair: log.group[2],
                timestamp: log.ts_bucket,
              });
            } else if (log.group.length === 4) {
              result.push({
                spanId: log.group[0],
                status: log.group[1],
                pair: log.group[2],
                timestamp: log.ts_bucket,
                attemptDetails: {
                  txUrl: log.group[3],
                },
              });
            } else if (log.group.length === 7) {
              result.push({
                spanId: log.group[0],
                status: log.group[1],
                pair: log.group[2],
                timestamp: log.ts_bucket,
                attemptDetails: {
                  quote: JSON.parse(log.group[3]),
                  fullAttempt: {
                    marketPrice: log.group[4],
                    error: log.group[5],
                    route: JSON.parse(log.group[6])[0],
                  },
                },
              });
            } else if (log.group.length === 10) {
              result.push({
                spanId: log.group[0],
                status: 'no opportunity',
                pair: log.group[1],
                timestamp: log.ts_bucket,
                attemptDetails: {
                  quote: JSON.parse(log.group[2]),
                  fullAttempt: {
                    marketPrice: log.group[3],
                    error: log.group[4],
                    route: JSON.parse(log.group[5])[0],
                  },
                  partialAttempt: {
                    amountIn: log.group[6],
                    marketPrice: log.group[7],
                    error: log.group[8],
                    route: JSON.parse(log.group[9])[0],
                  },
                },
              });
            } else {
              // unexpected result, should not be possible
            }
          }
        }
      }
    }
  
    // return sorted data by timestamp in desc order
    return result.sort((a, b) => b.timestamp - a.timestamp);
  }
  
  /**
   * Query rain solver logs for the given token in past number of minutes.
   * @param {number} chainId - The chain id of the order
   * @param {string} tokenSymbol - The token symbol
   * @param {number} endTime - The end timestamp in millis, default is "now" if omitted
   * @param {number} duration - Timespan of logs in minutes before endTime, default is 5 if omitted
   * @returns {Promise<RainSolverLog[]>}
   */
  export async function queryRainSolverByToken(
    chainId: number,
    tokenSymbol: string,
    endTime: number = Date.now(),
    duration: number = 5,
  ) {
    if (!HDXServices[chainId]) {
      return [];
    }
    const startTime = endTime - duration * 60_000;
    const format = {
      dataSource: 'events',
      aggFn: 'count',
    };
  
    // build query details
    const requestDetails = [
      [
        {
          ...format,
          where: `service:"${HDXServices[chainId]}" order_ -*routeProcessor.* details.pair:*${tokenSymbol}*`,
          groupBy: ['span_id', 'otel.status_description', 'details.pair', 'details.orders'],
        },
      ],
      [
        {
          ...format,
          where: `service:"${HDXServices[chainId]}" order_ routeProcessor.route details.pair:*${tokenSymbol}*`,
          groupBy: ['span_id', 'details.routeProcessor.route', 'details.pair', 'details.orders'],
        },
      ],
      [
        {
          ...format,
          where: `service:"${HDXServices[chainId]}" order_ foundOpp:true details.pair:*${tokenSymbol}*`,
          groupBy: [
            'span_id',
            'otel.status_description',
            'details.pair',
            'details.txUrl',
            'details.orders',
          ],
        },
      ],
      [
        {
          ...format,
          where: `service:"${HDXServices[chainId]}" order_ full -partial details.pair:*${tokenSymbol}*`,
          groupBy: [
            'span_id',
            'otel.status_description',
            'details.pair',
            'details.quote',
            'details.routeProcessor.full.marketPrice',
            'details.routeProcessor.full.error',
            'details.routeProcessor.full.route',
            'details.orders',
          ],
        },
      ],
      [
        {
          ...format,
          where: `service:"${HDXServices[chainId]}" order_ partial details.pair:*${tokenSymbol}*`,
          groupBy: [
            'span_id',
            'details.pair',
            'details.quote',
            'details.routeProcessor.full.marketPrice',
            'details.routeProcessor.full.error',
            'details.routeProcessor.full.route',
            'details.routeProcessor.partial.amountIn',
            'details.routeProcessor.partial.marketPrice',
            'details.routeProcessor.partial.error',
            'details.orders',
          ],
        },
      ],
    ].map((series) => ({
      series,
      endTime,
      startTime,
      granularity: '30 second',
      seriesReturnType: 'column',
    }));
  
    // concurrently fetch solver logs for each request format
    const responses = await Promise.allSettled(
      requestDetails.map(async (requestBody) => {
        const response = await fetch('/api/proxy', {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.REACT_APP_HYPERDX_API_KEY}`,
          },
        });
        const result = await response.json();
        if ('data' in result) return result.data;
        else return Promise.reject(result);
      }),
    );
  
    // parse responses into specified types
    /** @type {RainSolverLog[]} */
    const result = [];
    for (const res of responses) {
      if (res.status === 'fulfilled') {
        for (const log of res.value) {
          if (log?.group?.length) {
            if (log.group.length === 4) {
              result.push({
                spanId: log.group[0],
                status: log.group[1] === 'no-way' ? 'no route' : log.group[1],
                pair: log.group[2],
                timestamp: log.ts_bucket,
                orderHash: JSON.parse(log.group[3])[0],
              });
            } else if (log.group.length === 5) {
              result.push({
                spanId: log.group[0],
                status: log.group[1],
                pair: log.group[2],
                timestamp: log.ts_bucket,
                attemptDetails: {
                  txUrl: log.group[3],
                },
                orderHash: JSON.parse(log.group[4])[0],
              });
            } else if (log.group.length === 8) {
              result.push({
                spanId: log.group[0],
                status: log.group[1],
                pair: log.group[2],
                timestamp: log.ts_bucket,
                attemptDetails: {
                  quote: JSON.parse(log.group[3]),
                  fullAttempt: {
                    marketPrice: log.group[4],
                    error: log.group[5],
                    route: JSON.parse(log.group[6])[0],
                  },
                },
                orderHash: JSON.parse(log.group[7])[0],
              });
            } else if (log.group.length === 10) {
              result.push({
                spanId: log.group[0],
                status: 'no opportunity',
                pair: log.group[1],
                timestamp: log.ts_bucket,
                attemptDetails: {
                  quote: JSON.parse(log.group[2]),
                  fullAttempt: {
                    marketPrice: log.group[3],
                    error: log.group[4],
                    route: JSON.parse(log.group[5])[0],
                  },
                  partialAttempt: {
                    amountIn: log.group[6],
                    marketPrice: log.group[7],
                    error: log.group[8],
                  },
                },
                orderHash: JSON.parse(log.group[9])[0],
              });
            } else {
              // unexpected result, should not be possible
            }
          }
        }
      }
    }
  
    // return sorted data by timestamp in desc order
    return result.sort((a, b) => b.timestamp - a.timestamp);
  }
  