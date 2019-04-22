var socket = io("https://evening-springs-71938.herokuapp.com/");

integralFluctuationAverages = {};

socket.on("calculationResult", function(result) {
	if(integralFluctuationAverages[result.velocity] == null) {
		integralFluctuationAverages[result.velocity] = { sum: 0, samples: 0 };
		var noticeBox = document.createElement('div');
		noticeBox.setAttribute("id", "box-"+result.velocity);
		var notice = document.createTextNode('For the velocity of ' + result.velocity + ', the average e^(-Delta S) is currently equal to ');
		var velocityHolder = document.createElement('div');
		velocityHolder.setAttribute("class", "velocity");
		var notice2 = document.createTextNode(' and currently has ');
		var samplesHolder = document.createElement('div');
		samplesHolder.setAttribute("class", "samples");
		var notice3 = document.createTextNode(' samples.');
		document.body.appendChild(noticeBox);
		noticeBox.appendChild(notice);
		noticeBox.appendChild(velocityHolder);
		noticeBox.appendChild(notice2);
		noticeBox.appendChild(samplesHolder);
		noticeBox.appendChild(notice3);

	}
	fluctuationAverages = integralFluctuationAverages[result.velocity];
	fluctuationAverages.sum += Math.exp(-result.entropy);
	fluctuationAverages.samples++;
	console.log("Velocity: " + result.velocity + ", Average: " + fluctuationAverages.sum/fluctuationAverages.samples);
	document.getElementById("box-" + result.velocity).getElementsByClassName('velocity')[0].innerHTML = result.velocity;
	document.getElementById("box-" + result.velocity).getElementsByClassName('samples')[0].innerHTML = result.samples;
});
