<script lang="ts">
	import type { MarkCfg, PlotCfg as PlotT, TransformCfg } from '@rainlanguage/orderbook/js_api';
	import * as Plot from '@observablehq/plot';
	import { onMount } from 'svelte';
	import { analyzeLiquidity } from '$lib/analyzeLiquidity';
	import { page } from '$app/stores';

	const { settings, tokenSlug, network } = $page.data.stores;

	let plot: PlotT;
	// let data: TransformedPlotData[];
	let div: HTMLElement;
	let div2: HTMLElement;

	let data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((d) =>
		Math.sin(d)
	);

	let olympicAthletes = [
		{
			id: 736041664,
			name: 'A Jesus Garcia',
			nationality: 'ESP',
			sex: 'male',
			date_of_birth: '1969-10-17',
			height: 1.72,
			weight: 64,
			sport: 'athletics',
			gold: 0,
			silver: 0,
			bronze: 0
		},
		{
			id: 532037425,
			name: 'A Lam Shin',
			nationality: 'KOR',
			sex: 'female',
			date_of_birth: '1986-09-23',
			height: 1.68,
			weight: 56,
			sport: 'fencing',
			gold: 0,
			silver: 0,
			bronze: 0
		},
		{
			id: 435962603,
			name: 'Aaron Brown',
			nationality: 'CAN',
			sex: 'male',
			date_of_birth: '1992-05-27',
			height: 1.98,
			weight: 79,
			sport: 'athletics',
			gold: 0,
			silver: 0,
			bronze: 1
		},
		{
			id: 521041435,
			name: 'Aaron Cook',
			nationality: 'MDA',
			sex: 'male',
			date_of_birth: '1991-01-02',
			height: 1.83,
			weight: 80,
			sport: 'taekwondo',
			gold: 0,
			silver: 0,
			bronze: 0
		},
		{
			id: 33922579,
			name: 'Aaron Gate',
			nationality: 'NZL',
			sex: 'male',
			date_of_birth: '1990-11-26',
			height: 1.81,
			weight: 71,
			sport: 'cycling',
			gold: 0,
			silver: 0,
			bronze: 0
		},
		{
			id: 173071782,
			name: 'Aaron Royle',
			nationality: 'AUS',
			sex: 'male',
			date_of_birth: '1990-01-26',
			height: 1.8,
			weight: 67,
			sport: 'triathlon',
			gold: 0,
			silver: 0,
			bronze: 0
		},
		{
			id: 266237702,
			name: 'Aaron Russell',
			nationality: 'USA',
			sex: 'male',
			date_of_birth: '1993-06-04',
			height: 2.05,
			weight: 98,
			sport: 'volleyball',
			gold: 0,
			silver: 0,
			bronze: 1
		},
		{
			id: 382571888,
			name: 'Aaron Younger',
			nationality: 'AUS',
			sex: 'male',
			date_of_birth: '1991-09-25',
			height: 1.93,
			weight: 100,
			sport: 'aquatics',
			gold: 0,
			silver: 0,
			bronze: 0
		},
		{
			id: 87689776,
			name: 'Aauri Lorena Bokesa',
			nationality: 'ESP',
			sex: 'female',
			date_of_birth: '1988-12-14',
			height: 1.8,
			weight: 62,
			sport: 'athletics',
			gold: 0,
			silver: 0,
			bronze: 0
		},
		{
			id: 997877719,
			name: 'Ababel Yeshaneh',
			nationality: 'ETH',
			sex: 'female',
			date_of_birth: '1991-07-22',
			height: 1.65,
			weight: 54,
			sport: 'athletics',
			gold: 0,
			silver: 0,
			bronze: 0
		},
		{
			id: 343694681,
			name: 'Abadi Hadis',
			nationality: 'ETH',
			sex: 'male',
			date_of_birth: '1997-11-06',
			height: 1.7,
			weight: 63,
			sport: 'athletics',
			gold: 0,
			silver: 0,
			bronze: 0
		},
		{
			id: 591319906,
			name: 'Abbas Abubakar Abbas',
			nationality: 'BRN',
			sex: 'male',
			date_of_birth: '1996-05-17',
			height: 1.75,
			weight: 66,
			sport: 'athletics',
			gold: 0,
			silver: 0,
			bronze: 0
		},
		{
			id: 258556239,
			name: 'Abbas Qali',
			nationality: 'IOA',
			sex: 'male',
			date_of_birth: '1992-10-11',
			height: null,
			weight: null,
			sport: 'aquatics',
			gold: 0,
			silver: 0,
			bronze: 0
		},
		{
			id: 376068084,
			name: "Abbey D'Agostino",
			nationality: 'USA',
			sex: 'female',
			date_of_birth: '1992-05-25',
			height: 1.61,
			weight: 49,
			sport: 'athletics',
			gold: 0,
			silver: 0,
			bronze: 0
		},
		{
			id: 162792594,
			name: 'Abbey Weitzeil',
			nationality: 'USA',
			sex: 'female',
			date_of_birth: '1996-12-03',
			height: 1.78,
			weight: 68,
			sport: 'aquatics',
			gold: 1,
			silver: 1,
			bronze: 0
		},
		{
			id: 521036704,
			name: 'Abbie Brown',
			nationality: 'GBR',
			sex: 'female',
			date_of_birth: '1996-04-10',
			height: 1.76,
			weight: 71,
			sport: 'rugby sevens',
			gold: 0,
			silver: 0,
			bronze: 0
		}
	];
	let aapl = [
		{
			Date: new Date('2013-05-13'),
			Open: 64.501427,
			High: 65.414284,
			Low: 64.5,
			Close: 64.96286,
			Volume: 79237200
		},
		{
			Date: new Date('2013-05-14'),
			Open: 64.835716,
			High: 65.028572,
			Low: 63.164288,
			Close: 63.408573,
			Volume: 111779500
		},
		{
			Date: new Date('2013-05-15'),
			Open: 62.737144,
			High: 63.0,
			Low: 60.337143,
			Close: 61.264286,
			Volume: 185403400
		},
		{
			Date: new Date('2013-05-16'),
			Open: 60.462856,
			High: 62.549999,
			Low: 59.842857,
			Close: 62.082859,
			Volume: 150801000
		},
		{
			Date: new Date('2013-05-17'),
			Open: 62.721428,
			High: 62.869999,
			Low: 61.572857,
			Close: 61.894287,
			Volume: 106976100
		}
	];

	let google = [
		{
			Date: new Date('2013-05-13'),
			Open: 64.501427,
			High: 65.414284,
			Low: 64.5,
			Close: 54.96286,
			Volume: 79237200
		},
		{
			Date: new Date('2013-05-14'),
			Open: 64.835716,
			High: 65.028572,
			Low: 63.164288,
			Close: 53.408573,
			Volume: 111779500
		},
		{
			Date: new Date('2013-05-15'),
			Open: 62.737144,
			High: 63.0,
			Low: 60.337143,
			Close: 51.264286,
			Volume: 185403400
		},
		{
			Date: new Date('2013-05-16'),
			Open: 60.462856,
			High: 62.549999,
			Low: 59.842857,
			Close: 52.082859,
			Volume: 150801000
		},
		{
			Date: new Date('2013-05-17'),
			Open: 62.721428,
			High: 62.869999,
			Low: 61.572857,
			Close: 51.894287,
			Volume: 106976100
		}
	];

	let trades = [
		{ Date: new Date('2013-05-13').getDate(), Raindex: 10, External: 10, Total: 20 },
		{ Date: new Date('2013-05-14').getDate(), Raindex: 20, External: 21, Total: 41 },
		{ Date: new Date('2013-05-15').getDate(), Raindex: 30, External: 33, Total: 63 },
		{ Date: new Date('2013-05-16').getDate(), Raindex: 40, External: 35, Total: 75 },
		{ Date: new Date('2013-05-17').getDate(), Raindex: 50, External: 55, Total: 105 }
	];

	$: {

		async function fetchData() {
			const result = await analyzeLiquidity(
				$network,
				$tokenSlug.toUpperCase(),
				new Date().getTime() / 1000 - 1000 * 60 * 60 * 24 * 1,
				new Date().getTime() / 1000
			);
			console.log(JSON.stringify(result.tradesAccordingToTimeStamp));
		}

		fetchData();

		div?.firstChild?.remove(); // remove old chart, if any
		div?.append(
			Plot.plot({
				grid: true,
				figure: true,
				color: { legend: true },
				title: 'Historical Trade Distirbution',

				marks: [
					Plot.frame(),
					Plot.ruleY([0]),
					Plot.barY(trades, {
						x: 'Date',
						y: 'Total',
						fill: 'rgb(38, 128, 217)',
						tip: { fontSize: 14, fontFamily: 'monospace' }
					}),
					Plot.barY(trades, {
						x: 'Date',
						y: 'Raindex',
						fill: 'rgb(11, 38, 65)',
						tip: { fontSize: 14, fontFamily: 'monospace' }
					})
				],

				width: 800,
				height: 400,
				inset: 10,
				aspectRatio: 1,
				x: {
					padding: 0.4,
					label: 'Date',
					labelAnchor: 'center'
				},
				y: {
					label: 'Total and Raindex',
					labelAnchor: 'center'
				}
			})
		);
	}
</script>

<div class="w-full" bind:this={div}></div>
<!-- <div class="flex flex-row gap-4 p-2">
<div class="w-1/2" bind:this={div2}></div>
</div> -->
