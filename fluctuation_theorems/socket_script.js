var socket = io("https://evening-springs-71938.herokuapp.com/");

integralFluctuationAverages = {};

function WorkPositionEntry() {
	this.sum = 0;
	this.samples = 0;
}

function WorkByPositionIndex() {
	this.positions = [];
}

WorkByPositionIndex.prototype.initializePosition = function(position) {
	this[position] = new WorkPositionEntry();
	this.positions.push(position);
}

WorkByPositionIndex.prototype.addData = function(work, position) {
	this[position].samples++;
	this[position].sum += Math.exp(work);
}

WorkByPositionIndex.prototype.getGraphingArray = function() {
	returnData = [];
	this.positions.forEach(function(position) {
		returnData.push({ position: position, estimateFreeEnergy: -Math.log(this[position].sum/this[position].samples)});
	});
	return returnData;
}

socket.on("calculationResult", function(result) {
	if(integralFluctuationAverages[result.velocity] == null) {
		workByPosition = new WorkByPositionIndex();
		result.workHistory.forEach(function (workEntry) {
			workByPosition.initializePosition(workEntry.position);
		});
		integralFluctuationAverages[result.velocity] = { sum: 0, samples: 0, entropies: [], entropyLowerings: 0, exponentialWorkByPosition: workByPosition };
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
		var freeEnergyChart = document.createElement('div');
		freeEnergyChart.setAttribute("id", "energy-graph-" + result.velocity);

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
		noticeBox.appendChild(freeEnergyChart);
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
	// console.log("Velocity: " + result.velocity + ", Average: " + average); 
	
	workByPosition = fluctuationAverages.exponentialWorkByPosition;
	result.workHistory.forEach(function(workEntry) {
		workByPosition.addData(workEntry.work, workEntry.position);
	});

	document.getElementById(elementName).getElementsByClassName('integration-fluctionation-average')[0].innerHTML = average;
	document.getElementById(elementName).getElementsByClassName('samples')[0].innerHTML = fluctuationAverages.samples;
	document.getElementById(elementName).getElementsByClassName('lowerings')[0].innerHTML = fluctuationAverages.entropyLowerings;
	document.getElementById(elementName).getElementsByClassName('lowerings-proportion')[0].innerHTML = Number(100*fluctuationAverages.entropyLowerings/fluctuationAverages.samples).toFixed(3);
	MG.data_graphic({
		data: fluctuationAverages.entropies,
		width: 650,
		height: 350,
		target: "#histogram-" + result.velocity.toString().replace(".","\\."),
		chart_type: "histogram"
	});
	MG.data_graphic({
		data: workByPosition.getGraphingArray(),
		width: 650,
		height: 350,
		target: "#energy-graph-" + result.velocity.toString().replace(".","\\."),
		x_accessor: 'position',
		y_accessor: 'estimateFreeEnergy'
	});
});
