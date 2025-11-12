const SECONDS_PER_DAY = 86400;
const MAX_DECAY_DAYS = 90;

function calculateTimeDecay(departureTimestamp) {
  const now = Date.now() / 1000;
  const secondsLeft = departureTimestamp - now;
  
  if (secondsLeft <= 0) {
    return 0.0;
  }
  
  const daysLeft = secondsLeft / SECONDS_PER_DAY;
  
  if (daysLeft >= MAX_DECAY_DAYS) {
    return 1.0;
  }
  
  return daysLeft / MAX_DECAY_DAYS;
}

function calculateRiskPenalty(basePrice, riskFactor) {
  return basePrice * riskFactor;
}

function calculateFinalPrice(apiData) {
  const basePrice = apiData.basePriceUSD;
  const departureTime = apiData.departureTimestamp;
  const risk = apiData.cancellationRisk;
  
  const timeFactor = calculateTimeDecay(departureTime);
  const timeAdjustedPrice = basePrice * timeFactor;
  
  const riskPenalty = calculateRiskPenalty(basePrice, risk);
  
  let finalPrice = timeAdjustedPrice - riskPenalty;
  
  if (finalPrice < 0) {
    finalPrice = 0;
  }
  
  return Math.floor(finalPrice);
}

module.exports = {
  calculateFinalPrice,
  calculateTimeDecay,
  calculateRiskPenalty 
};