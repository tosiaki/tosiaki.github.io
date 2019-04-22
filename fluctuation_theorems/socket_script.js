var socket = io("https://evening-springs-71938.herokuapp.com/");

integralFluctuationAverages = {};

socket.on("calculationResult", function(result) {
	if(integralFluctuationAverages[result.velocity] == null) {
		integralFluctuationAverages[result.velocity] = { sum: 0, samples: 0, entropies: [], entropyLowerings: 0 };
		var noticeBox = document.createElement('div');
		noticeBox.setAttribute("id", "box-"+result.velocity);
		var notice = document.createTextNode('For the velocity of ' + result.velocity + ', the average e^(-Delta S) is currently equal to ');
		var velocityHolder = document.createElement('span');
		velocityHolder.setAttribute("class", "integration-fluctionation-average");
		var notice2 = document.createTextNode(' and currently has ');
		var samplesHolder = document.createElement('span');
		samplesHolder.setAttribute("class", "samples");
		var notice3 = document.createTextNode(' samples. The number of times the entropy has been lowered is ');
		var loweringsHolder = document.createElement('span');
		loweringsHolder.setAttribute("class", "lowerings");
		var notice4 = document.createTextNode(' for a percentage of ');
		var loweringsProportionHolder = document.createElement('span');
		loweringsProportionHolder.setAttribute("class", "lowerings-proportion");
		var notice5 = document.createTextNode('%.');
		var chart = document.createElement('div');
		chart.setAttribute("id", "histogram-" + result.velocity);

		document.body.appendChild(noticeBox);
		noticeBox.appendChild(notice);
		noticeBox.appendChild(velocityHolder);
		noticeBox.appendChild(notice2);
		noticeBox.appendChild(samplesHolder);
		noticeBox.appendChild(notice3);
		noticeBox.appendChild(loweringsHolder);
		noticeBox.appendChild(notice4);
		noticeBox.appendChild(loweringsProportionHolder);
		noticeBox.appendChild(notice5);
		noticeBox.appendChild(chart);
	}
	elementName = "box-" + result.velocity;
	fluctuationAverages = integralFluctuationAverages[result.velocity];
	fluctuationAverages.sum += Math.exp(-result.entropy);
	fluctuationAverages.entropies.push(result.entropy);
	fluctuationAverages.samples++;
	if(result.entropy < 0) {
		fluctuationAverages.entropyLowerings++;
	}
	average = fluctuationAverages.sum/fluctuationAverages.samples;
	console.log("Velocity: " + result.velocity + ", Average: " + average); 
	document.getElementById(elementName).getElementsByClassName('integration-fluctionation-average')[0].innerHTML = average;
	document.getElementById(elementName).getElementsByClassName('samples')[0].innerHTML = fluctuationAverages.samples;
	document.getElementById(elementName).getElementsByClassName('lowerings')[0].innerHTML = fluctuationAverages.entropyLowerings;
	document.getElementById(elementName).getElementsByClassName('lowerings-proportion')[0].innerHTML = fluctuationAverages.entropyLowerings/fluctuationAverages.samples;
	MG.data_graphic({
		data: fluctuationAverages.entropies,
		width: 650,
		height: 350,
		target: "#histogram-" + result.velocity.toString().replace(".","\\."),
		chart_type: "histogram"
	});
});
