var socket = io("https://evening-springs-71938.herokuapp.com/");

integralFluctuationAverages = {};

socket.on("calculationResult", function(result) {
	if(integralFluctuationAverages[result.velocity] == null) {
		integralFluctuationAverages[result.velocity] = { sum: 0, samples: 0 };
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
		chart.setAttribute("class", "histogram");
		MG.data_graphic({
			data: [],
			width: 650,
			height: 150,
			target: "#box-"+result.velocity+".histogram",
			x_accessor: 'entropy'
		});
		document.body.appendChild(noticeBox);
		noticeBox.appendChild(notice);
		noticeBox.appendChild(velocityHolder);
		noticeBox.appendChild(notice2);
		noticeBox.appendChild(samplesHolder);
		noticeBox.appendChild(notice3);
		noticeBox.appendChild(chart);

	}
	elementName = "box-" + result.velocity;
	data = {};
	data[result.entropy] = 1;
	document.getElementById(elementName).getElementsByClassName("histogram")[0].push({
		time: Date.now(),
		histogram: data
	});
	fluctuationAverages = integralFluctuationAverages[result.velocity];
	fluctuationAverages.sum += Math.exp(-result.entropy);
	fluctuationAverages.samples++;
	average = fluctuationAverages.sum/fluctuationAverages.samples;
	console.log("Velocity: " + result.velocity + ", Average: " + average); 
	document.getElementById(elementName).getElementsByClassName('integration-fluctionation-average')[0].innerHTML = average;
	document.getElementById(elementName).getElementsByClassName('samples')[0].innerHTML = fluctuationAverages.samples;
});
