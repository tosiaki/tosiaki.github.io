var socket = io("https://evening-springs-71938.herokuapp.com/");

integralFluctuationAverages = {};

socket.on("calculationResult", function(result) {
	if(integralFluctuationAverages[result.velocity] == null) {
		integralFluctuationAverages[result.velocity] = { sum: 0, samples: 0, entropies: [] };
		var noticeBox = document.createElement('div');
		noticeBox.setAttribute("id", "box-"+result.velocity);
		var notice = document.createTextNode('For the velocity of ' + result.velocity + ', the average e^(-Delta S) is currently equal to ');
		var velocityHolder = document.createElement('span');
		velocityHolder.setAttribute("class", "integration-fluctionation-average");
		var notice2 = document.createTextNode(' and currently has ');
		var samplesHolder = document.createElement('span');
		samplesHolder.setAttribute("class", "samples");
		var notice3 = document.createTextNode(' samples.');
		var chart = document.createElement('div');
		chart.setAttribute("id", "histogram-" + result.velocity);

		document.body.appendChild(noticeBox);
		noticeBox.appendChild(notice);
		noticeBox.appendChild(velocityHolder);
		noticeBox.appendChild(notice2);
		noticeBox.appendChild(samplesHolder);
		noticeBox.appendChild(notice3);
		noticeBox.appendChild(chart);
	}
	elementName = "box-" + result.velocity;
	fluctuationAverages = integralFluctuationAverages[result.velocity];
	fluctuationAverages.sum += Math.exp(-result.entropy);
	fluctuationAverages.entropies.push(result.entropy);
	fluctuationAverages.samples++;
	average = fluctuationAverages.sum/fluctuationAverages.samples;
	console.log("Velocity: " + result.velocity + ", Average: " + average); 
	document.getElementById(elementName).getElementsByClassName('integration-fluctionation-average')[0].innerHTML = average;
	document.getElementById(elementName).getElementsByClassName('samples')[0].innerHTML = fluctuationAverages.samples;
	MG.data_graphic({
		data: fluctuationAverages.entropies,
		width: 650,
		height: 350,
		target: "#histogram-" + result.velocity.toString().replace(".","\\."),
		chart_type: "histogram"
	});
});
