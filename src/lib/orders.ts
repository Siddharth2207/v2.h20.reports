export function formatTimestamp(timestamp: number) {
	if (!timestamp || timestamp === 0) {
		return 'N/A';
	}

	const dateObj = new Date(timestamp * 1000);

	const date = dateObj.toLocaleDateString('en-GB', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric'
	});

	const time = dateObj.toLocaleTimeString('en-GB', {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	});

	return `${date} ${time}`;
}

export const formatBalance = (balance: number) => {
	if (!balance || isNaN(balance)) return '0.00';

	const absValue = Math.abs(balance);
	const sign = balance < 0 ? '-' : '';

	const formatter = new Intl.NumberFormat('en-US', {
		notation: 'compact',
		maximumFractionDigits: 2
	});

	return sign + formatter.format(absValue);
};
