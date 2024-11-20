document.addEventListener('DOMContentLoaded', () => {
    // Constants
    const CRYPTOCOMPARE_API = 'https://min-api.cryptocompare.com/data';
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;
    const SP500_ANNUAL_RETURN = 0.10; // 10% average annual return
    const GOLD_ANNUAL_RETURN = 0.05;  // 5% average annual return

    // Cache for API responses
    const priceCache = new Map();

    // Get elements
    const investmentType = document.querySelectorAll('.toggle-btn');
    const oneTimeFields = document.getElementById('one-time-fields');
    const dcaFields = document.getElementById('dca-fields');
    const investmentAmount = document.getElementById('investment-amount');
    const investmentDate = document.getElementById('investment-date');
    const monthlyAmount = document.getElementById('monthly-amount');
    const startDate = document.getElementById('start-date');
    const endDate = document.getElementById('end-date');
    const calculateBtn = document.getElementById('calculate');
    const loadingContainer = document.getElementById('loading');
    const errorContainer = document.getElementById('error');
    const resultsContainer = document.querySelector('.results');
    const chartSection = document.querySelector('.chart-section');
    const chartCanvas = document.getElementById('investmentChart');

    // Get result elements
    const totalInvested = document.getElementById('total-invested');
    const btcAmount = document.getElementById('btc-amount');
    const avgPrice = document.getElementById('avg-price');
    const currentPrice = document.getElementById('current-price');
    const currentValue = document.getElementById('current-value');
    const profitLoss = document.getElementById('profit-loss');
    const roi = document.getElementById('roi');
    const annualizedReturn = document.getElementById('annualized-return');
    const sp500Return = document.getElementById('sp500-return');
    const goldReturn = document.getElementById('gold-return');

    // Set min/max dates
    const today = new Date().toISOString().split('T')[0];
    const bitcoinStart = '2015-01-01'; // Start from 2015 for better data availability
    [investmentDate, startDate, endDate].forEach(input => {
        if (input) {
            input.min = bitcoinStart;
            input.max = today;
            input.value = '2024-10-11'; // Set default to 2017
        }
    });

    async function fetchWithRetry(url, retries = MAX_RETRIES) {
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return await response.json();
            } catch (error) {
                if (i === retries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            }
        }
    }

    async function getBitcoinPrices(startDate, endDate) {
        const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
        const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000);
        const cacheKey = `prices-${startTimestamp}-${endTimestamp}`;

        if (priceCache.has(cacheKey)) {
            return priceCache.get(cacheKey);
        }

        try {
            // Get current price
            const currentPriceUrl = `${CRYPTOCOMPARE_API}/price?fsym=BTC&tsyms=USD`;
            const currentPriceData = await fetchWithRetry(currentPriceUrl);
            const currentPrice = currentPriceData.USD;

            // Get historical daily data with exchange and aggregate parameters
            const url = `${CRYPTOCOMPARE_API}/v2/histoday?fsym=BTC&tsym=USD&e=CCCAGG&limit=2000&toTs=${endTimestamp}&tryConversion=true&aggregate=1`;
            const data = await fetchWithRetry(url);
            
            if (data.Response === "Success" && data.Data.Data.length > 0) {
                const prices = new Map();
                
                // Add historical prices using closing prices
                data.Data.Data
                    .filter(d => d.time >= startTimestamp && d.close > 0)
                    .forEach(d => {
                        const dateStr = new Date(d.time * 1000).toISOString().split('T')[0];
                        prices.set(dateStr, d.close);
                    });

                // Add current price for today
                prices.set(today, currentPrice);

                // If we don't have the exact start date, get the closest date
                if (!prices.has(startDate)) {
                    // Get historical daily data specifically for start date
                    const startDateUrl = `${CRYPTOCOMPARE_API}/v2/histoday?fsym=BTC&tsym=USD&e=CCCAGG&limit=1&toTs=${startTimestamp}&tryConversion=true&aggregate=1`;
                    const startDateData = await fetchWithRetry(startDateUrl);
                    
                    if (startDateData.Response === "Success" && startDateData.Data.Data.length > 0) {
                        const startPrice = startDateData.Data.Data[0].close;
                        if (startPrice > 0) {
                            prices.set(startDate, startPrice);
                        }
                    }
                }

                // Verify we have valid prices
                if (!prices.has(startDate)) {
                    throw new Error('Unable to get historical Bitcoin price for the selected date');
                }

                priceCache.set(cacheKey, prices);
                return prices;
            }
            throw new Error('Failed to fetch Bitcoin prices');
        } catch (error) {
            throw new Error('Failed to fetch Bitcoin prices. Please try again.');
        }
    }

    function calculateAnnualizedReturn(startValue, endValue, years) {
        return years > 0 ? Math.pow(endValue / startValue, 1 / years) - 1 : 0;
    }

    function formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'PHP',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }

    function formatPercent(value) {
        return new Intl.NumberFormat('en-US', {
            style: 'percent',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    }

    function formatBTC(amount) {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 8,
            maximumFractionDigits: 8
        }).format(amount);
    }

    function createInvestmentChart(dates, bitcoinValues, sp500Values, goldValues) {
        // Destroy existing chart if it exists
        if (window.investmentChart instanceof Chart) {
            window.investmentChart.destroy();
        }

        const ctx = chartCanvas.getContext('2d');
        window.investmentChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [
                    {
                        label: 'Collaborative coins',
                        data: bitcoinValues,
                        borderColor: getComputedStyle(document.documentElement)
                            .getPropertyValue('--primary-color').trim(),
                        backgroundColor: 'rgba(247, 147, 26, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Competitor A',
                        data: sp500Values,
                        borderColor: getComputedStyle(document.documentElement)
                            .getPropertyValue('--sp500-color').trim(),
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4
                    },
                    {
                        label: 'Competitor B',
                        data: goldValues,
                        borderColor: getComputedStyle(document.documentElement)
                            .getPropertyValue('--gold-color').trim(),
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: value => formatCurrency(value)
                        }
                    }
                }
            }
        });
    }

    async function calculateOneTimeInvestment(amount, date) {
        const prices = await getBitcoinPrices(date, today);
        const historicalPrice = prices.get(date);
        const currentBtcPrice = prices.get(today);

        if (!historicalPrice || !currentBtcPrice) {
            throw new Error('Unable to get Bitcoin prices for the selected dates');
        }

        const btcPurchased = amount / historicalPrice;
        const currentVal = btcPurchased * currentBtcPrice;
        const profit = currentVal - amount;
        const years = Math.max((new Date(today) - new Date(date)) / (365 * 24 * 60 * 60 * 1000), 0.0001);

        // Calculate values for chart
        const dates = Array.from(prices.keys()).sort();
        const bitcoinValues = dates.map(d => {
            const price = prices.get(d);
            return price ? btcPurchased * price : null;
        }).filter(val => val !== null);

        const sp500Values = dates.map(d => {
            const yearsSinceStart = Math.max((new Date(d) - new Date(date)) / (365 * 24 * 60 * 60 * 1000), 0);
            return amount * Math.pow(1 + SP500_ANNUAL_RETURN, yearsSinceStart);
        });

        const goldValues = dates.map(d => {
            const yearsSinceStart = Math.max((new Date(d) - new Date(date)) / (365 * 24 * 60 * 60 * 1000), 0);
            return amount * Math.pow(1 + GOLD_ANNUAL_RETURN, yearsSinceStart);
        });

        createInvestmentChart(dates, bitcoinValues, sp500Values, goldValues);

        return {
            totalInvested: amount,
            btcAmount: btcPurchased,
            averagePrice: historicalPrice,
            currentPrice: currentBtcPrice,
            currentValue: currentVal,
            profitLoss: profit,
            roi: profit / amount,
            annualizedReturn: calculateAnnualizedReturn(amount, currentVal, years),
            years
        };
    }

    async function calculateDCA(monthlyAmount, startDate, endDate) {
        const end = endDate || today;
        const prices = await getBitcoinPrices(startDate, end);
        
        let totalInvested = 0;
        let totalBtc = 0;
        let investments = [];
        let currentDate = new Date(startDate);
        const endDateTime = new Date(end);

        // Calculate monthly investments
        while (currentDate <= endDateTime) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const price = prices.get(dateStr);
            
            if (price && price > 0) {
                const btcPurchased = monthlyAmount / price;
                totalInvested += monthlyAmount;
                totalBtc += btcPurchased;
                investments.push({ date: dateStr, btc: btcPurchased });
            }
            
            currentDate.setMonth(currentDate.getMonth() + 1);
        }

        if (investments.length === 0) {
            throw new Error('No valid price data available for the selected period');
        }

        const currentBtcPrice = prices.get(today);
        if (!currentBtcPrice) {
            throw new Error('Unable to get current Bitcoin price');
        }

        const currentVal = totalBtc * currentBtcPrice;
        const profit = currentVal - totalInvested;
        const years = Math.max((new Date(end) - new Date(startDate)) / (365 * 24 * 60 * 60 * 1000), 0.0001);

        // Calculate values for chart
        const dates = Array.from(prices.keys()).sort();
        const bitcoinValues = dates.map(date => {
            const price = prices.get(date);
            if (!price) return null;
            const btcOwned = investments
                .filter(inv => inv.date <= date)
                .reduce((sum, inv) => sum + inv.btc, 0);
            return btcOwned * price;
        }).filter(val => val !== null);

        const sp500Values = dates.map(date => {
            let value = 0;
            investments.forEach(inv => {
                if (inv.date <= date) {
                    const yearsSinceInvestment = Math.max((new Date(date) - new Date(inv.date)) / (365 * 24 * 60 * 60 * 1000), 0);
                    value += monthlyAmount * Math.pow(1 + SP500_ANNUAL_RETURN, yearsSinceInvestment);
                }
            });
            return value;
        });

        const goldValues = dates.map(date => {
            let value = 0;
            investments.forEach(inv => {
                if (inv.date <= date) {
                    const yearsSinceInvestment = Math.max((new Date(date) - new Date(inv.date)) / (365 * 24 * 60 * 60 * 1000), 0);
                    value += monthlyAmount * Math.pow(1 + GOLD_ANNUAL_RETURN, yearsSinceInvestment);
                }
            });
            return value;
        });

        createInvestmentChart(dates, bitcoinValues, sp500Values, goldValues);

        return {
            totalInvested,
            btcAmount: totalBtc,
            averagePrice: totalInvested / totalBtc,
            currentPrice: currentBtcPrice,
            currentValue: currentVal,
            profitLoss: profit,
            roi: profit / totalInvested,
            annualizedReturn: calculateAnnualizedReturn(totalInvested, currentVal, years),
            years
        };
    }

    function showError(message) {
        errorContainer.textContent = message;
        errorContainer.style.display = 'block';
        loadingContainer.style.display = 'none';
        resultsContainer.style.display = 'none';
        chartSection.style.display = 'none';
    }

    function updateResults(results) {
        totalInvested.textContent = formatCurrency(results.totalInvested);
        btcAmount.textContent = `${formatBTC(results.btcAmount)} BTC`;
        avgPrice.textContent = formatCurrency(results.averagePrice);
        currentPrice.textContent = formatCurrency(results.currentPrice);
        currentValue.textContent = formatCurrency(results.currentValue);
        profitLoss.textContent = formatCurrency(results.profitLoss);
        roi.textContent = formatPercent(results.roi);
        annualizedReturn.textContent = formatPercent(results.annualizedReturn);

        // Calculate traditional investment returns
        const sp500Value = Math.pow(1 + SP500_ANNUAL_RETURN, results.years);
        const goldValue = Math.pow(1 + GOLD_ANNUAL_RETURN, results.years);
        sp500Return.textContent = formatPercent(sp500Value - 1);
        goldReturn.textContent = formatPercent(goldValue - 1);

        // Apply profit/loss colors
        profitLoss.className = results.profitLoss >= 0 ? 'profit' : 'loss';
        roi.className = results.roi >= 0 ? 'profit' : 'loss';
        annualizedReturn.className = results.annualizedReturn >= 0 ? 'profit' : 'loss';

        errorContainer.style.display = 'none';
        loadingContainer.style.display = 'none';
        resultsContainer.style.display = 'block';
        chartSection.style.display = 'block';
    }

    async function calculateReturns() {
        const isOneTime = oneTimeFields.style.display !== 'none';
        
        try {
            errorContainer.style.display = 'none';
            loadingContainer.style.display = 'block';
            resultsContainer.style.display = 'none';
            chartSection.style.display = 'none';

            let results;
            if (isOneTime) {
                const amount = parseFloat(investmentAmount.value);
                const date = investmentDate.value;

                if (!amount || !date) {
                    throw new Error('Please fill in all fields');
                }

                results = await calculateOneTimeInvestment(amount, date);
            } else {
                const amount = parseFloat(monthlyAmount.value);
                const start = startDate.value;
                const end = endDate.value || today;

                if (!amount || !start) {
                    throw new Error('Please fill in all required fields');
                }

                results = await calculateDCA(amount, start, end);
            }

            updateResults(results);
        } catch (error) {
            showError(error.message);
        }
    }

    // Add event listeners
    calculateBtn.addEventListener('click', calculateReturns);

    investmentType.forEach(btn => {
        btn.addEventListener('click', () => {
            investmentType.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            if (btn.dataset.type === 'one-time') {
                oneTimeFields.style.display = 'block';
                dcaFields.style.display = 'none';
            } else {
                oneTimeFields.style.display = 'none';
                dcaFields.style.display = 'block';
            }
        });
    });

    // Handle Enter key
    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                calculateReturns();
            }
        });
    });

    // Add input validation
    investmentAmount.addEventListener('input', () => {
        const value = parseFloat(investmentAmount.value);
        if (value < 0) investmentAmount.value = 0;
        if (value > 1000000000) investmentAmount.value = 1000000000;
    });

    monthlyAmount.addEventListener('input', () => {
        const value = parseFloat(monthlyAmount.value);
        if (value < 0) monthlyAmount.value = 0;
        if (value > 1000000) monthlyAmount.value = 1000000;
    });
});
