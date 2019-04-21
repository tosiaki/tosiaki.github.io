var socket = io("https://evening-springs-71938.herokuapp.com/");

integralFluctuationAverages = {};

socket.on("newVelocity", function(velocity) {
	integralFluctuationAverages['result.velocity'] = { sum: 0, samples: 0 };
});

socket.on("calculationResult", function(result) {
	fluctuationAverages = integralFluctuationAverages['result.velocity'];
	fluctuationAverages.sum += Math.exp(-result.entropy);
	fluctuationAverages.samples++;
	console.log("Velocity: " + result.velocity + ", Average: " + fluctuationAverages.sum/samples);
});
