import * as d3 from "d3";

class SwitchLevel {
	level: number = 0
	switches: Switch[] = []
	width: number = 0
	height: number = 0

	constructor(level: number) {
		this.level = level
	}

	addSwitch(s: Switch) {
		this.switches.push(s!)

		if (s!.x + 1 > this.width) {
			this.width = s!.x + 1
		}

		if (s!.y + 1 > this.height) {
			this.height = s!.y + 1
		}
	}

	filter(minX: number, maxX: number, minY: number, maxY: number): Switch[] {
		let maxCount = 1000
		let nodes: Switch[] = []


		for (let x = minX; x <= maxX && x < this.width; x++) {
			for (let y = minY; y <= maxY && y < this.height; y++) {
				let index = x + y * this.width
				nodes.push(this.switches[index])

				if (nodes.length > maxCount) {
					return nodes
				}
			}
		}

		return nodes
	}
}

class Switch {
	x: number
	y: number
	screenX: number = 0
	screenY: number = 0
	zoomLevel: number = 0

	constructor(x: number, y: number, zoomLevel: number) {
		this.x = x
		this.y = y
		this.zoomLevel = zoomLevel
	}
}


class Renderer {
	canvas?: HTMLElement
	width: number
	height: number
	nodes: SwitchLevel[]
	zoomLevel: number = 2.5
	totalLevels: number = 0
	baseSize: number = 200
	zoomLevelToSizeMap: Map<number, [number, number, number]> = new Map();

	constructor(canvas?: HTMLElement) {
		this.canvas = canvas;
		this.width = 1024
		this.height = 1024

		let width = this.width
		let height = this.height
		this.nodes = []
		let level = 0
		while (width > 1 && height > 1) {
			let currLevelNodes = new SwitchLevel(level)

			for (let i = 0; i < height; i++) {
				for (let j = 0; j < width; j++) {
					currLevelNodes.addSwitch(new Switch(j, i, level))
				}
			}
			width /= 2
			height /= 2
			level += 1

			this.nodes.push(currLevelNodes)
		}

		this.totalLevels = level
		this.calculateNodeSize()
	}

	calculateNodeSize() {
		let nodeSize = this.baseSize
		let gapSize = this.baseSize / 2
		let offset = gapSize
		this.zoomLevelToSizeMap.set(0, [nodeSize, gapSize, offset])

		for (let level = 1; level < this.totalLevels; level++) {
			nodeSize = nodeSize * 2 + gapSize * 2
			gapSize = nodeSize / 2
			offset = offset
			this.zoomLevelToSizeMap.set(level, [nodeSize, gapSize, offset])
		}
	}

	zoom(delta: number) {
		this.zoomLevel -= delta
		if (this.zoomLevel < 1) {
			this.zoomLevel = 1
		}

		console.log(`Zoom level: ${this.zoomLevel}`)
		this.render()
	}

	render() {
		let mainZoomLevel = Math.round(this.zoomLevel)
		let levelsToDisplay = this.nodes.slice(
			mainZoomLevel - 1, mainZoomLevel + 2).reverse()
		if (levelsToDisplay.length == 0) {
			if (mainZoomLevel < 2) {
				levelsToDisplay.push(this.nodes[0])
			} else {
				levelsToDisplay.push(this.nodes[this.nodes.length - 1])
			}
		}

		let levels = d3.select(this.canvas!)
			.selectAll<SVGGElement, SwitchLevel>('g')
			.data(levelsToDisplay, (d: SwitchLevel) => d.level)

		let newLevels = levels.enter()
			.append('g')
			.attr('zoom-level', (d: SwitchLevel) => d.level)

		newLevels.merge(levels).each((d, i, levels) => {
			this.renderNodesInLevel(d, levels[i])
		})

		levels.exit().remove()
	}

	calculateLevelSize(
		level: number,
	): number[] {
		let dominatingLevel = Math.ceil(this.zoomLevel)
		let levelDiff = dominatingLevel - this.zoomLevel
		const baseSize = this.baseSize * (3.3 ** levelDiff)

		let gapSizes = [0, 0, 0, 0, baseSize * .1]
		let nodeSize = baseSize * .9

		for (let l = dominatingLevel; l >= level; l--) {
			let gapSize = nodeSize / 2 * .2
			gapSizes.push(gapSize)

			nodeSize = nodeSize / 2 * .8
		}

		console.log(`ZoomLevel: ${this.zoomLevel}, Curr Level: ${level}, Sizes: ${nodeSize}, ${gapSizes}`)
		// const baseSize = this.baseSize ** (1 / this.zoomLevel) / this.zoomLevel
		// console.log(baseSize)

		// let levelSize = baseSize
		// for (let i = 0; i < level; i++) {
		// 	levelSize *= 2
		// }

		// const ratio = 1 - 1 / this.zoomLevel
		// const nodeSize = levelSize * ratio
		// const gapSize = levelSize * (1 - ratio)
		// const offsetSize = 0

		return [nodeSize,
			gapSizes[gapSizes.length - 1],
			gapSizes[gapSizes.length - 2],
			gapSizes[gapSizes.length - 3],
			gapSizes[gapSizes.length - 4],
			0
		]
	}

	// calculateMainLevelSize(level: number): [number, number, number] {
	// 	let baseSize = 100
	// 	let levelDiff = level - this.zoomLevel
	// 	let scaleCoeff = 3.3
	// 	let levelSize = baseSize * Math.pow(scaleCoeff, levelDiff)

	// 	return [levelSize * .5, levelSize * .5, levelSize]
	// }

	// calculateAboveLevelSize(level: number): [number, number, number] {
	// 	let [baseSize, baseGap, baseOffset] = this.calculateLevelSize(level - 1)

	// 	let baseLevelSize = baseSize + baseGap
	// 	let levelSize = baseLevelSize * 2

	// 	return [levelSize * .9, levelSize * .1, baseOffset - 0.25 * baseGap]
	// }


	renderNodesInLevel(
		level: SwitchLevel, container: SVGGElement,
	) {
		let [nodeSize, gapSize, twoGapSize, fourGapSize, eightGapSize, offsetSize] =
			this.calculateLevelSize(level.level)
		let levelSize = nodeSize + gapSize

		let canvas = document.getElementById('canvas')
		let canvasWidth = canvas!.clientWidth
		let canvasHeight = canvas!.clientHeight
		let leftCoord = 0
		let topCoord = 0
		let rightCoord = canvasWidth / levelSize
		let bottomCoord = canvasHeight / levelSize

		let nodesToDisplay = level.filter(
			leftCoord, rightCoord,
			topCoord, bottomCoord,
		)

		let nodeList = d3.select(container)
			.selectAll<SVGRectElement, Switch>('rect')
			.data(nodesToDisplay, (d: Switch) => `${d.x}-${d.y}-${d.zoomLevel}`)

		let newNodes = nodeList.enter()
			.append('rect')
		// .attr('x', (d: Switch) => {
		// 	return d.x * levelSize + d.x / 2 * twoGapSize + d.x / 4 * fourGapSize + offsetSize
		// })
		// .attr('y', (d: Switch) => {
		// 	return d.y * levelSize + d.y / 2 * twoGapSize + d.y / 4 * fourGapSize + offsetSize
		// })
		// .attr('width', nodeSize)
		// .attr('height', nodeSize)
		// .attr('fill', '#99d8c9')
		// .attr('stroke', '#000000')
		// .attr('stroke-width', 3)

		newNodes.merge(nodeList)
			.transition()
			.duration(200)
			.attr('x', (d: Switch) => {
				return d.x * levelSize +
					Math.floor(d.x / 2) * twoGapSize +
					Math.floor(d.x / 4) * fourGapSize +
					Math.floor(d.x / 8) * eightGapSize +
					offsetSize
			})
			.attr('y', (d: Switch) => {
				return d.y * levelSize +
					Math.floor(d.y / 2) * twoGapSize +
					Math.floor(d.y / 4) * fourGapSize +
					Math.floor(d.y / 8) * eightGapSize +
					offsetSize
			})
			.attr('width', nodeSize)
			.attr('height', nodeSize)
			.attr('fill', '#99d8c9')
			.attr('stroke', '#000000')
			.attr('stroke-width', 3)
			.attr('opacity', (d: Switch) => {
				if (this.zoomLevel > 10) {
					return 1
				}

				if (Math.abs(d.zoomLevel - this.zoomLevel) < 1) {
					return 1
				}

				return (2 - Math.abs(d.zoomLevel - this.zoomLevel)) / 2 + 0.5
			})


		nodeList.exit().remove();
	}
}

let r = new Renderer(document.getElementById('grid')!);
r.render();

document.getElementById('canvas')!
	.addEventListener('wheel', (e: WheelEvent) => {
		r.zoom(e.deltaY / 3000)
	})