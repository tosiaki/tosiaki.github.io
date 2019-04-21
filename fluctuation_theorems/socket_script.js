var socket = io("https://evening-springs-71938.herokuapp.com/");

socket.on("calculationResult", function(result) {
	console.log(result.totalWork);
});
