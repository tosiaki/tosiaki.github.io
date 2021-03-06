// modules/spacetime

define([
	'jquery',
	'underscore'
], function($, _){
	
	// -----------
	// | Private |
	// -----------

		// Spacetime, array that stores all objects
		var spacetime = [];

		// Simulation settings
		var calculationsPerSec 	= 100; 	// How many gravitational calculations are performed a second
		var calculationSpeed 	= 1; 	// Speed comes at the cost of accuracy
		var massMultiplier;				// How exagurated the size of the objects are (human readable)

		// Calculation setInterval loop
		var spacetimeLoop;

		var debugLoop = setInterval(function(){
			var totalMass = 0;

			for (var i = 0; i < spacetime.length; i++) {
				totalMass += spacetime[i].mass;
			};
		}, 1000);

		// Takes object as argument, returns velocity as positive integer
		function getVelocity(object){
			var velocity = Math.sqrt(
				Math.pow(object.velX, 2)+
				Math.pow(object.velY, 2)
			);

			return velocity;
		}

		// Takes object as argument, returns momentum as positive integer (unless object mass is negative)
		function getMomentum(object){
			var velocity = getVelocity(object);

			return velocity * object.mass;
		}

		// Takes two objects as argument, returns distance between the two
		function getObjectDistance(objectA, objectB){
			var distance = Math.sqrt(
				Math.pow(objectA.x - objectB.x, 2) +
				Math.pow(objectA.y - objectB.y, 2)
			);

			return distance;
		}

		// Takes in object, returns radius from object mass and density
		function getObjectRadius(object){
			var radius = Math.cbrt(
				(object.mass*object.density*massMultiplier) / (4/3*Math.PI)
			);
			
			return radius;
		}

		function objectConstructor(object){

			// Coords
			this.x = object.x;
			this.y = object.y;
			this.lastX = object.x - object.velX * calculationSpeed;
			this.lastY = object.y - object.velY * calculationSpeed;
			//this.charge = this.charge || Math.random() - 0.5;

			// Velocity
			this.velX = object.velX;
			this.velY = object.velY;
			this.accX = 0;
			this.accY = 0;

			// Delta velocity (start at zero)
			this.deltaVelX = 0;
			this.deltaVelY = 0;

			// Mass
			this.mass = object.mass

			// Density, defaults to 1 if undefined
			this.density = object.density !== undefined ? object.density : 1;

			// Path, starts empty
			this.path = object.path !== undefined ? object.path : [];

			// Camera focus, defaults: false
			this.cameraFocus = object.cameraFocus !== undefined ? object.cameraFocus : false;
		}

		function addObject(object){
			var newObject = new objectConstructor(object);

			spacetime.push(newObject);
		}

		// Takes in two objects, joins them if they're within eachothers radius
		function joinObjects(objectA, objectB){
			if (
				getObjectDistance(objectA, objectB)*5 < getObjectRadius(objectA) + getObjectRadius(objectB) /* &&
				(objectA.velX-objectB.velX)*(objectA.velX-objectB.velX)+(objectA.velY-objectB.velY)*(objectA.velY-objectB.velY) < objectA.mass*objectB.mass/5 */
			){
				// Splice the objects from spacetime
				spacetime = _.without(spacetime, objectA);
				spacetime = _.without(spacetime, objectB);

				// Check if camera is focused on either object, if so the camera will be focused on this new object
				var cameraFocus = false;
				if(objectA.cameraFocus === true || objectB.cameraFocus === true){
					cameraFocus = true;
				}

				// New mass
				var mass = objectA.mass + objectB.mass;
				//var charge = objectA.charge + objectB.charge;

				// Coords
				var x = objectA.x*objectA.mass/mass + objectB.x*objectB.mass/mass;
				var y = objectA.y*objectA.mass/mass + objectB.y*objectB.mass/mass;

				objectA.velX = (objectA.x - objectA.lastX)/calculationSpeed;
				objectB.velX = (objectB.x - objectB.lastX)/calculationSpeed;

				// Velocity
				var velX = objectA.velX*objectA.mass/mass + objectB.velX*objectB.mass/mass;
				var velY = objectA.velY*objectA.mass/mass + objectB.velY*objectB.mass/mass;

				// New density calculated from both objects mass and density
				var density = objectA.density*objectA.mass/mass+
							  objectB.density*objectB.mass/mass;

				// New path is a copy of the larger object's path
				var path = objectA.mass >= objectB.mass ? objectA.path : objectB.path;

				// Construct new object and add to spacetime
				var newObject = new objectConstructor({
					cameraFocus: 	cameraFocus,
					x: 				x,
					y: 				y,
					velX: 			velX,
					velY: 			velY,
					accX: 0,
					accY: 0,
					mass: 			mass,
					//charge: charge,
					density: 		density,
					path: 			path
				});

				if(spacetime.length < 0) {
					distance = bnRoot.CoM[0]*Math.random();
					angle = 2*Math.PI*Math.random();
					speed = Math.sqrt(Math.sqrt(bnRoot.CoM[0])/Math.sqrt(distance));
					direction = angle + Math.PI/2;
					var newObject2 = new objectConstructor({
						cameraFocus: 	false,
						x: 				distance*Math.cos(angle) + bnRoot.CoM[1], // -x+(Math.random()-0.5)*Math.min(mass*5,2000*Math.sqrt(spacetime.length)),
						y: 				distance*Math.sin(angle) + bnRoot.CoM[2], // -y+(Math.random()-0.5)*Math.min(mass*5,2000*Math.sqrt(spacetime.length)),
						velX: 			speed*Math.cos(direction), //Math.sqrt(mass)*(Math.random()-0.5)*2.4,
						velY: 			speed*Math.sin(direction), //+Math.sqrt(mass)*(Math.random()-0.5)*2.4,
						accX: 0,
						accY: 0,
						mass: 			Math.random(), 
						//charge: charge,
						density: 		density,
						path: 			[]
					});
					addObject(newObject2);
				}

				if(spacetime.length < Math.sqrt(bnRoot.CoM[0])*10 && spacetime.length < 0) {
					distance = bnRoot.CoM[0]*Math.random();
					angle = 2*Math.PI*Math.random();
					speed = Math.sqrt(Math.sqrt(bnRoot.CoM[0])/Math.sqrt(distance));
					direction = angle + Math.PI/2;
					var newObject3 = new objectConstructor({
						cameraFocus: 	false,
						x: 				distance*Math.cos(angle) + bnRoot.CoM[1], // -x+(Math.random()-0.5)*Math.min(mass*5,2000*Math.sqrt(spacetime.length)),
						y: 				distance*Math.sin(angle) + bnRoot.CoM[2], // -y+(Math.random()-0.5)*Math.min(mass*5,2000*Math.sqrt(spacetime.length)),
						velX: 			speed*Math.cos(direction), //Math.sqrt(mass)*(Math.random()-0.5)*2.4,
						velY: 			speed*Math.sin(direction), //+Math.sqrt(mass)*(Math.random()-0.5)*2.4,
						accX: 0,
						accY: 0,
						mass: 			Math.random(), 
						//charge: charge,
						density: 		density,
						path: 			[]
					});
					addObject(newObject3);
					distance = bnRoot.CoM[0]*Math.random();
					angle = 2*Math.PI*Math.random();
					speed = Math.sqrt(Math.sqrt(bnRoot.CoM[0])/Math.sqrt(distance));
					direction = angle + Math.PI/2;
					var newObject3 = new objectConstructor({
						cameraFocus: 	false,
						x: 				distance*Math.cos(angle) + bnRoot.CoM[1], // -x+(Math.random()-0.5)*Math.min(mass*5,2000*Math.sqrt(spacetime.length)),
						y: 				distance*Math.sin(angle) + bnRoot.CoM[2], // -y+(Math.random()-0.5)*Math.min(mass*5,2000*Math.sqrt(spacetime.length)),
						velX: 			speed*Math.cos(direction), //Math.sqrt(mass)*(Math.random()-0.5)*2.4,
						velY: 			speed*Math.sin(direction), //+Math.sqrt(mass)*(Math.random()-0.5)*2.4,
						accX: 0,
						accY: 0,
						mass: 			Math.random(), 
						//charge: charge,
						density: 		density,
						path: 			[]
					});
					addObject(newObject3);
					distance = bnRoot.CoM[0]*Math.random();
					angle = 2*Math.PI*Math.random();
					speed = Math.sqrt(Math.sqrt(bnRoot.CoM[0])/Math.sqrt(distance));
					direction = angle + Math.PI/2;
					var newObject3 = new objectConstructor({
						cameraFocus: 	false,
						x: 				distance*Math.cos(angle) + bnRoot.CoM[1], // -x+(Math.random()-0.5)*Math.min(mass*5,2000*Math.sqrt(spacetime.length)),
						y: 				distance*Math.sin(angle) + bnRoot.CoM[2], // -y+(Math.random()-0.5)*Math.min(mass*5,2000*Math.sqrt(spacetime.length)),
						velX: 			speed*Math.cos(direction), //Math.sqrt(mass)*(Math.random()-0.5)*2.4,
						velY: 			speed*Math.sin(direction), //+Math.sqrt(mass)*(Math.random()-0.5)*2.4,
						accX: 0,
						accY: 0,
						mass: 			Math.random(), 
						//charge: charge,
						density: 		density,
						path: 			[]
					});
					addObject(newObject3);
				}

				addObject(newObject);

				console.log(spacetime.length);

				return true;
			}
			else {
				return false;
			};
		}
		var MAXDEPTH = 50; // BN tree max depth ( one less than actual, example with maxdepth = 2, the levels are [0 1 2] )
		var BN_THETA = 0.5;
		var DISTANCE_MULTIPLE = 1;
		var G = 1; // Gravitational Constant
		//var Electric = 20; // Electric constant
		var ETA = 0; // Softening constant
		var GFACTOR = 2; // Higher means distance has more effect (3 is reality)

		function bnDeleteTree() {
			if (bnRoot) {bnRoot = bnDeleteNode(bnRoot);}
		}
		function bnDeleteNode(node) {
			node.b = null;
			node.box = null;
			// For each child
			for (var i=0;i<4;i++) {
				if (node.nodes[i]) { // If child exists
					node.nodes[i] = bnDeleteNode(node.nodes[i]);
				}
			}
			return null;
		}
		
		var bnRoot;
		var maxPosX = 0;
		var minPosX = 0;
		var maxPosY = 0;
		var minPosY = 0;
		function bnBuildTree() {
			bnDeleteTree(bnRoot); // Delete Tree to clear memory
			bnRoot = {b: [], // Body
				leaf:true,
				CoM: null, // center of mass
				//CoP: null, // center of positive charge
				//CoN: null, // center of negative charge
				nodes:[null,null,null,null],
				// x y x2 y2
				box:[minPosX,minPosY,maxPosX,maxPosY]};
			
			// Add each body to tree
			for (var i=0;i<spacetime.length;i++) {
				if (pointInBBOX(spacetime[i].x,spacetime[i].y,bnRoot.box)) {
					bnAddBody(bnRoot,i,0);
				}
			}
			// bnSetTreeStats(); // Update bn tree stats
		}

		// BBOX = [x y x2 y2]
		function pointInBBOX(x,y,BBOX) {
			if (x >= BBOX[0] && x <= BBOX[2] && y >= BBOX[1] && y <= BBOX[3]) {return true;}
			else {return false;}
		}
		
		function bnAddBody(node,i,depth) {
			// if node has body already
			if ( node.b.length > 0 ) { // not empty
				// Check if hit max depth
				if (depth > MAXDEPTH) {
					node.b [node.b.length] = i; // Add body to same node since already at max depth
				} 
				else {
					var subBodies;
					if (!node.leaf) { // Same as saying node.b = "PARENT"
						// Node is a parent with children
						subBodies = [i];
					} else {
						// Node is a leaf node (no children), turn to parent
						subBodies = [node.b,i];
					}
					for (var k=0;k<subBodies.length;k++) {
						// Add body to children too		
						var quad = getQuad(subBodies[k],node.box);
						var child = node.nodes[quad];
						if (child) {
							// if quad has child, recurse with child
							bnAddBody(child,subBodies[k],depth+1);
						} else {
							// else add body to child
							node = bnMakeNode(node,quad,subBodies[k]);
						}
					}
					node.b = ["PARENT"];
					node.leaf = false; // Always going to turn into a parent if not already
				}
				// Update center of mass
				node.CoM[1] = (node.CoM[1]*node.CoM[0] + spacetime[i].x*spacetime[i].mass)/(node.CoM[0]+spacetime[i].mass);
				node.CoM[2] = (node.CoM[2]*node.CoM[0] + spacetime[i].y*spacetime[i].mass)/(node.CoM[0]+spacetime[i].mass);
				node.CoM[0] += spacetime[i].mass;

				// if (spacetime[i].charge > 0) {
				// 	node.CoP[1] = (node.CoP[1]*node.CoP[0] + spacetime[i].x*spacetime[i].charge)/(node.CoP[0]+spacetime[i].charge);
				// 	node.CoP[2] = (node.CoP[2]*node.CoP[0] + spacetime[i].y*spacetime[i].charge)/(node.CoP[0]+spacetime[i].charge);
				// 	node.CoP[0] += spacetime[i].charge;
				// }

				// if (spacetime[i].charge < 0) {
				// 	node.CoN[1] = (node.CoN[1]*node.CoN[0] + spacetime[i].x*spacetime[i].charge)/(node.CoN[0]+spacetime[i].charge);
				// 	node.CoN[2] = (node.CoN[2]*node.CoN[0] + spacetime[i].y*spacetime[i].charge)/(node.CoN[0]+spacetime[i].charge);
				// 	node.CoN[0] += spacetime[i].charge;
				// }
			} else { // else if node empty, add body
				node.b = [i];
				node.CoM = [spacetime[i].mass, spacetime[i].x,spacetime[i].y]; // Center of Mass set to the position of single body
				// if (spacetime[i].charge >= 0) {
				// 	node.CoP = [spacetime[i].charge, spacetime[i].x, spacetime[i].y];
				// } else {
				// 	node.CoP = [0, spacetime[i].x, spacetime[i].y]
				// }
				// if (spacetime[i].charge < 0) {
				// 	node.CoN = [spacetime[i].charge, spacetime[i].x, spacetime[i].y];
				// } else {
				// 	node.CoN = [0, spacetime[i].x, spacetime[i].y]
				// }
			}
		}
		function getQuad(i,box) {
			var mx = (box[0]+box[2])/2;
			var my = (box[1]+box[3])/2;
			if (spacetime[i].x < mx) { // Left
				if (spacetime[i].y < my) {return 0;} // Top
				else {return 2;} // Bottom
			}
			else { // right
				if (spacetime[i].y < my) {return 1;} // Top
				else {return 3;} // Bottom}
			}
		}
		function bnMakeNode(parent,quad,child) {
			var child = {b:[child],
				leaf:true,
				CoM : [spacetime[child].mass, spacetime[child].x,spacetime[child].y], // Center of Mass set to the position of single body
				//CoP : [Math.max(spacetime[child].charge,0),spacetime[child].x,spacetime[child].y],
				//CoN : [Math.min(spacetime[child].charge,0),spacetime[child].x,spacetime[child].y],
				nodes:[null,null,null,null],
				box:[0,0,0,0]};

			switch (quad) {
				case 0: // Top Left
					child.box = [parent.box[0],
						parent.box[1],
						(parent.box[0]+parent.box[2])/2, 
						(parent.box[1]+parent.box[3])/2];
					break;
				case 1: // Top Right
					child.box = [(parent.box[0]+parent.box[2])/2,
						parent.box[1],
						parent.box[2], 
						(parent.box[1]+parent.box[3])/2];
					break;
				case 2: // Bottom Left
					child.box = [parent.box[0],
						(parent.box[1]+parent.box[3])/2,
						(parent.box[0]+parent.box[2])/2, 
						parent.box[3]];
					break;
				case 3: // Bottom Right
					child.box = [(parent.box[0]+parent.box[2])/2,
						(parent.box[1]+parent.box[3])/2,
						parent.box[2], 
						parent.box[3]];
					break;
			}
			parent.nodes[quad] = child;
			return parent;
		}
		
		function doBNtree(bI) {
			doBNtreeRecurse(bI,bnRoot);
		}
		function doBNtreeRecurse(bI,node) {
			if (node.leaf) {
				// If node is a leaf node
				for (var k=0;k<node.b.length;k++) {
					if (bI != node.b[k]) { // Skip self
						setAccel(bI,node.b[k],false);
						numChecks += 1;
					}
				}
			}
			else {
				var s = Math.max( node.box[2]-node.box[0] , node.box[3]-node.box[1] ); // Biggest side of box
				var d = getDistSquared(spacetime[bI].x,spacetime[bI].y,
					node.CoM[1],node.CoM[2]);
				if (s*s/d < BN_THETA*BN_THETA) {
					setAccelDirect(bI,node.CoM[0],node.CoM[1],node.CoM[2])
					numChecks += 1;
				}
				else {
					// Recurse for each child
					for (var k=0;k<4;k++) {
						if (node.nodes[k]) {doBNtreeRecurse(bI,node.nodes[k]);}
					}
				}
			}
		}

		function getDistSquared(x,y,x2,y2) {
			return (x2-x)*(x2-x) + (y2-y)*(y2-y)
		}
		// Update accelerations using BN tree
		function forceBNtree() {
			bnBuildTree(); // Build BN tree based on current pos
			numChecks = 0;
			for (var i=0;i<spacetime.length;i++) {
				// For each body
				doBNtree(i);
			}
		}
		
		function setAccel(i,j,do_Both) {
			do_Both = typeof(do_Both) != 'undefined' ? do_Both : true;
			
			// Get Force Vector between bodies i, j
			var acc = getAccelVec(i,j);

			// a = F/m
			// Body i
			spacetime[i].accX += acc[0];
			spacetime[i].accY += acc[1];
			
			if (do_Both) {
				// Body j, equal and opposite force
				spacetime[j].accX -= acc[0];
				spacetime[j].accY -= acc[1];
			}
		}
		function setAccelDirect(i,m,x,y) {
			// Set's accel according to given mass

			// get Force Vector between body i
			// and a virtual mass
			//   with mass m, at position cx,cy
			var F = getAccelVecDirect(
				spacetime[i].mass,spacetime[i].x,spacetime[i].y,
				m,x,y);
			
			// Update acceleration of body
			spacetime[i].accX += F[0];
			spacetime[i].accY += F[1];
		}
		
		function getAccelVec(i,j) {
			totalDistance = getObjectRadius(spacetime[i]) + getObjectRadius(spacetime[j]);
			currentDistanceSquared = getDistSquared(spacetime[i], spacetime[j]);
			if ( currentDistanceSquared < totalDistance*totalDistance) {
				dx = spacetime[j].x - spacetime[i].x;
				dy = spacetime[j].y - spacetime[i].y;
				acc = G*spacetime[j].mass*Math.sqrt(currentDistanceSquared)/(totalDistance*totalDistance*totalDistance*totalDistance);
				return [ acc*dx - (spacetime[i].velX-spacetime[j].velX)*spacetime[j].mass/spacetime[i].mass , acc*dy - (spacetime[i].velY-spacetime[j].velY)*spacetime[j].mass/spacetime[i].mass ];
			}
			else {
				return getAccelVecDirect(
					spacetime[i].mass,spacetime[i].x,spacetime[i].y,
					spacetime[j].mass,spacetime[j].x,spacetime[j].y
				);
			}
		}

		function getAccelVecDirect(m,x,y,m2,x2,y2) {
			// Determines force interaction between
			// bods[i] and bods[j], an adds to bods[i]
			var dx = x2-x;
			var dy = y2-y;
			var r2 = dx*dx + dy*dy;
			// F_{x|y} = d_{x|y}/r * G*M*m/r.^3;
			var acc = G*m2/r2;

			//var rp = (getDist(x,y,px,py)+ETA) * DISTANCE_MULTIPLE;
			//var Fp = -Electric*c*p/Math.pow(rp,GFACTOR);

			//var rn = (getDist(x,y,nx,ny)+ETA) * DISTANCE_MULTIPLE;
			//var Fn = -Electric*c*n/Math.pow(rn,GFACTOR);

			//return [ F*dx/r + Fp*(px-x)/rp + Fn*(nx-x)/rn, F*dy/r + Fp*(py-y)/rp + Fn*(ny-y)/rn];
			return [ acc*dx/Math.sqrt(r2), acc*dy/Math.sqrt(r2)];
		}
		
		var numChecks;

		function updateVel(dt_step) {
			// Update body velocities based on accelerations
			for (var i=0;i<spacetime.length;i++) {
				spacetime[i].velX += spacetime[i].accX*dt_step;
				spacetime[i].velY += spacetime[i].accY*dt_step;
			}
		}

		// Loops through all objects and calculates the delta velocity from gravitational forces
		function calculateObjectForce(){

			// updateVel(calculationSpeed);

			
			/*
			for (var a = spacetime.length - 1; a >= 0; a--) {
				var objectA = spacetime[a];

				// Calculate forces applied to objects
				for (var b = spacetime.length - 1; b >= 0; b--) {
					if (b !== a) {
						var objectB = spacetime[b];

						// getObjectDistance
						var distance = getObjectDistance(objectA, objectB);
						
						// Find angle from vector. Fun note, if we reverse objectA and B we have anti-gravity
						var angleToMass = Math.atan2(
							objectB.y-objectA.y,
							objectB.x-objectA.x
						);

						// All credit for this formula goes to an Isaac Newton
						objectA.deltaVelX += (
							Math.cos(angleToMass) *
							(objectB.mass/Math.pow(distance,2))
						);
						objectA.deltaVelY += (
							Math.sin(angleToMass) *
							(objectB.mass/Math.pow(distance,2))
						);
					};
				};
			};
			*/
			
			

		}

		// Loops through all objects and applies the force delta to the velocity
		function applyObjectForce(){
			for (var i = 0; i < spacetime.length; i++) {
				var object = spacetime[i];

				/*


				// add coords to object path
				object.path.push({
					x: object.x,
					y: object.y
				});

				// Limit path length
				if (object.path.length > Math.min(120, getObjectRadius(object) * 20 / getVelocity(object))) {
					object.path.splice(0, 1);
				};

				*/
				
				// object.velX += object.deltaVelX * calculationSpeed;
				// object.velY += object.deltaVelY * calculationSpeed;
				
				// object.velX += object.accX * calculationSpeed;
				// object.velY += object.accY * calculationSpeed;

				/*

				energy = 0.5*(object.velX*object.velX+object.velY*object.velY) - bnRoot.CoM[0]/Math.sqrt((object.x-bnRoot.CoM[1])*(object.x-bnRoot.CoM[1])+(object.y-bnRoot.CoM[2])*(object.y-bnRoot.CoM[2]));

				if (energy > 0) {
					if(object.x > 200*Math.sqrt(bnRoot.CoM[0]) + bnRoot.CoM[1] && object.velX > 0) {
						object.velX -= 0.001;
					}
					if(object.x < -200*Math.sqrt(bnRoot.CoM[0]) + bnRoot.CoM[1] && object.velX < 0) {
						object.velX += 0.001;
					}
					if(object.y > 200*Math.sqrt(bnRoot.CoM[0]) + bnRoot.CoM[2] && object.velY > 0) {
						object.velY -= 0.001;
					}
					if(object.y < -200*Math.sqrt(bnRoot.CoM[0]) + bnRoot.CoM[2] && object.velY < 0) {
						object.velY += 0.001;
					}
				}

				*/

				currentX = object.x;
				currentY = object.y;

				object.x += object.x - object.lastX + object.accX * calculationSpeed * calculationSpeed;
				object.y += object.y - object.lastY + object.accY * calculationSpeed * calculationSpeed;

				object.lastX = currentX;
				object.lastY = currentY;

				object.velX = object.x - object.lastX;
				object.velY = object.y - object.lastY;

				// Reset object delta velocity
				// object.deltaVelX = 0;
				// object.deltaVelY = 0;
				object.accX = 0;
				object.accY = 0;
			};

			for (var i = 0; i < spacetime.length; i++) {
				var object = spacetime[i];
				if ((object.x-bnRoot.CoM[1])*(object.x-bnRoot.CoM[1]) + (object.y-bnRoot.CoM[2])*(object.y-bnRoot.CoM[2]) > bnRoot.CoM[0]*bnRoot.CoM[0]*1000 ) {
					spacetime = _.without(spacetime, object);
				}
			}
		}

	// ----------
	// | Public |
	// ----------

		var api = {};

		// Initialize the api, call this before using
		api.initialize = function(p_massMultiplier){
			massMultiplier = p_massMultiplier;
		}

		// ------------------------
		// | Calculation settings |
		// ------------------------
		
			api.calculationsPerSec = function(number){
				calculationsPerSec = number;
			}

			api.calculationSpeed = function(number){
				calculationSpeed = number;
			}

			api.updateMassMultiplier = function(p_massMultiplier){
				massMultiplier = p_massMultiplier;
			}

			api.startLoop = function(){
				var self = this;

				spacetimeLoop = setInterval(function(){
					self.calculateForces();
				}, 1000/calculationsPerSec);
			}

			api.stopLoop = function(){
				clearInterval(spacetimeLoop);
			}
			
		// ------------------------
		// | Spacetime object api |
		// ------------------------

			api.addObject = function(object){
				addObject(object);
			}

			api.getFocusedObject = function () {
				var flagFocused = false;
				var i;
				for (i = 0; i < spacetime.length; i++) {
					if (spacetime[i].cameraFocus === true){
						flagFocused = true;
						break;
					}
				};
				if (flagFocused)
					return spacetime[i];
				else if (spacetime.length != 0) {
					api.cycleFocus();
					return spacetime[0];
				}
				else
					return false;
			}

			api.clearSpacetime = function(){
				spacetime = [];
			}

			api.cycleFocus = function(direction){ //direction: whether forwards or backwards in array. True for next, false for previous
				var objectFound = false;

				for (var i = 0; i < spacetime.length; i++) {
					if(spacetime[i].cameraFocus !== undefined && spacetime[i].cameraFocus === true){
						
						spacetime[i].cameraFocus = false;
						spacetime[((i + spacetime.length + ((direction) ? 1 : -1))%spacetime.length)].cameraFocus = true;
						objectFound = true;

						break;
					}
				};

				if (objectFound !== true && spacetime.length > 0) {
					spacetime[0].cameraFocus = true;
				};
			}

			api.getSpace = function(){
				return spacetime;
			}

			api.calculateForces = function(){
				var self = this;


				// -----------------------------------------
				// | Find clustering objects and join them |
				// -----------------------------------------
				function recursivelyJoinClusteringObjects(){
					maxPosX = spacetime[0].x;
					minPosX = spacetime[0].x;
					maxPosY = spacetime[0].y;
					minPosY = spacetime[0].y;
					var maxDiameter = 0.1;
					var grid = [];

					for (var i=0; i<spacetime.length; i++) {
						maxPosX = Math.max(maxPosX, spacetime[i].x);
						minPosX = Math.min(minPosX, spacetime[i].x);
						maxPosY = Math.max(maxPosY, spacetime[i].y);
						minPosY = Math.min(minPosY, spacetime[i].y);
						maxDiameter = Math.max(maxDiameter, 2*getObjectRadius(spacetime[i]))
					}

					

					for (var i=0; i<spacetime.length; i++) {
						gridPosX = Math.floor(spacetime[i].x/maxDiameter);
						gridPosY = Math.floor(spacetime[i].y/maxDiameter);
						grid[gridPosX] = grid[gridPosX] || [];
						grid[gridPosX][gridPosY] = grid[gridPosX][gridPosY] || [];
						grid[gridPosX][gridPosY].push(i)
					}

					for (gridPosX in grid) {
						for (gridPosY in grid[gridPosX]) {
							gridPosX = parseInt(gridPosX, 10);
							gridPosY = parseInt(gridPosY, 10);
							for (var a = grid[gridPosX][gridPosY].length - 1; a >= 0; a--) {
								var objectA = spacetime[grid[gridPosX][gridPosY][a]];
								for (var relPosX = -1; relPosX <= 1; relPosX++) {
									for (var relPosY = -1; relPosY <= 1; relPosY++) {
										if (grid[gridPosX+relPosX] && grid[gridPosX+relPosX][gridPosY+relPosY]) {
											for (var b = grid[gridPosX+relPosX][gridPosY+relPosY].length - 1; b >= 0; b--) {
												if (relPosX != 0 || relPosY !=0 || a != b ) {
													var objectB = spacetime[grid[gridPosX+relPosX][gridPosY+relPosY][b]];

													var joined = joinObjects(objectA, objectB);

													if (joined === true) {
														return recursivelyJoinClusteringObjects();
													};
												};
											};
										}
									}
								}
							};
						}
					}
					

				}

				recursivelyJoinClusteringObjects();

				// ----------------------------------------
				// | Newtons law of universal gravitation |
				// ----------------------------------------

				// Calculate gravitational forces between all objects
				// calculateObjectForce();
				bnBuildTree();
				forceBNtree();

				// Apply delta velocity to all objects
				applyObjectForce();
			}

		return api;

});
