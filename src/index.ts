import * as d3 from "d3";
import { zoom } from "d3";

class Switch {
	id: number
	x: number
	y: number

	constructor(id: number, x: number, y: number) {
		this.id = id
		this.x = x
		this.y = y
	}
}

class Minimap {
	scale: number = 1024
	offset_x: number = 0
	offset_y: number = 0

	constructor() {
	}

	draw(tile_width: number, tile_height: number) {
		const canvas = document.getElementById("minimap")!
		const canvas_width = canvas.clientWidth
		const canvas_height = canvas.clientHeight

		const width_scale = canvas_width / tile_width
		const height_scale = canvas_height / tile_height
		this.scale = Math.min(width_scale, height_scale) * .9

		this.offset_x = canvas_width / 2 - tile_width / 2 * this.scale
		this.offset_y = canvas_height / 2 - tile_height / 2 * this.scale

		const wafer_mini = d3.select("#wafer-mini");
		wafer_mini
			.attr("x", this.offset_x)
			.attr("y", this.offset_y)
			.attr("width", tile_width * this.scale)
			.attr("height", tile_height * this.scale)
			.attr("fill", "white")
			.attr("stroke", "blue")
	}

	update_minimap_viewport_box(
		top: number, left: number, width: number, height: number
	) {
		const viewport_box = d3.select("#minimap-viewport-box");

		viewport_box
			.attr("x", left * this.scale + this.offset_x)
			.attr("y", top * this.scale + this.offset_y)
			.attr("width", width * this.scale)
			.attr("height", height * this.scale)
			.attr("fill", "none")
			.attr("stroke", "green")
	}
}

class MainView {
	minimap: Minimap
	tile_width: number
	tile_height: number
	switches: Switch[][]
	scale: number = 1024
	min_x: number = 0
	max_x: number = 0
	min_y: number = 0
	max_y: number = 0

	constructor(
		minimap: Minimap,
		switches: Switch[][],
	) {
		this.minimap = minimap
		this.tile_width = switches[0].length
		this.tile_height = switches.length
		this.switches = switches
	}

	draw() {
		const node_size = 0.6
		const canvas = d3.select<SVGGElement, unknown>("#grid")

		let filtered_switches: Switch[] = []
		for (let i = 0; i < this.tile_height; i++) {
			for (let j = 0; j < this.tile_width; j++) {
				if (i % this.scale == 0 && j % this.scale == 0 &&
					i >= this.min_y && i < this.max_y &&
					j >= this.min_x && j < this.max_x) {
					filtered_switches.push(this.switches[i][j])
				}
			}
		}

		const rect = canvas.selectAll<SVGRectElement, Switch>("rect")
			.data(filtered_switches, (d) => d.id)

		const rect_enter = rect.enter().append("rect")
			.attr("x", (d) => d.x - node_size / 2)
			.attr("y", (d) => d.y - node_size / 2)


		rect.merge(rect_enter)
			.attr("width", (d) => {
				if (this.scale == 1) { return node_size }
				else { return node_size * this.scale }
			})
			.attr("height", (d) => {
				if (this.scale == 1) { return node_size }
				else { return node_size * this.scale }
			})
			.attr("fill", "white")
			.attr("stroke", "blue")
			.attr("stroke-width", this.scale * .02)

		rect.exit().remove()
	}

	initial_transform_param(): [number[], number] {
		const canvas = d3.select<SVGSVGElement, unknown>("#canvas")

		const canvas_width = canvas.node()!.clientWidth
		const canvas_height = canvas.node()!.clientHeight

		const scale_x = canvas_width / this.tile_width;
		const scale_y = canvas_height / this.tile_height;
		const scale = Math.min(scale_x, scale_y) * 0.9;

		const translate_x = canvas_width / 2 - this.tile_width / 2 * scale;
		const translate_y = canvas_height / 2 - this.tile_height / 2 * scale;

		return [[translate_x, translate_y], scale]
	}

	initialize_zoom() {
		const [initial_translate, initial_scale] =
			this.initial_transform_param()

		const canvas = d3.select<SVGSVGElement, unknown>("#canvas")
		const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
		canvas
			.call(zoomBehavior.on("zoom", (e) => {
				this.update_zoom(e.transform)
				console.log(e.transform)
			}))
			.call(zoomBehavior.transform,
				d3.zoomIdentity
					.translate(initial_translate[0], initial_translate[1])
					.scale(initial_scale)
			)
	}

	update_zoom(transform: d3.ZoomTransform) {
		const canvas = d3.select<SVGSVGElement, unknown>("#canvas")
		const grid = d3.select<SVGGElement, unknown>("#grid")

		grid.attr("transform", transform.toString())

		const top_left = this.reverse_mapping([0, 0], transform)
		const bottom_right = this.reverse_mapping(
			[canvas.node()!.clientWidth, canvas.node()!.clientHeight],
			transform)
		const viewport_width = bottom_right[0] - top_left[0]
		const viewport_height = bottom_right[1] - top_left[1]

		this.min_x = top_left[0]
		this.max_x = bottom_right[0]
		this.min_y = top_left[1]
		this.max_y = bottom_right[1]

		this.minimap.update_minimap_viewport_box(
			top_left[1], top_left[0], viewport_width, viewport_height)

		this.update_semantic_zoom(viewport_width, viewport_height)
	}

	update_semantic_zoom(width: number, height: number) {
		let count = width * height;
		this.scale = 1
		while (count > 500) { // At most 1000 nodes
			count /= 16
			this.scale *= 4
		}

		this.draw()
	}

	reverse_mapping(
		coord: number[],
		transform: d3.ZoomTransform,
	): number[] {
		const scale = transform.k
		const translate_x = transform.x
		const translate_y = transform.y

		const x_ = (coord[0] - translate_x) / scale
		const y_ = (coord[1] - translate_y) / scale

		return [x_, y_]
	}
}


function generate_data(width: number, height: number): Switch[][] {
	const switches: Switch[][] = []
	for (let i = 0; i < height; i++) {
		switches.push([])
		for (let j = 0; j < width; j++) {
			switches[i].push(new Switch(i * width + j, j, i))
		}
	}

	return switches
}

document.addEventListener("DOMContentLoaded", (event) => {
	const tile_width = 1024;
	const tile_height = 768;

	const switches = generate_data(tile_width, tile_height)

	const minimap = new Minimap()
	minimap.draw(tile_width, tile_height)

	const main_view = new MainView(minimap, switches)
	main_view.draw()
	main_view.initialize_zoom()
});

// class SwitchLevel {
// 	level: number = 0
// 	switches: Switch[] = []
// 	width: number = 0
// 	height: number = 0

// 	constructor(level: number) {
// 		this.level = level
// 	}

// 	addSwitch(s: Switch) {
// 		this.switches.push(s!)

// 		if (s!.x + 1 > this.width) {
// 			this.width = s!.x + 1
// 		}

// 		if (s!.y + 1 > this.height) {
// 			this.height = s!.y + 1
// 		}
// 	}

// 	filter(minX: number, maxX: number, minY: number, maxY: number): Switch[] {
// 		let maxCount = 1000
// 		let nodes: Switch[] = []


// 		for (let x = minX; x <= maxX && x < this.width; x++) {
// 			for (let y = minY; y <= maxY && y < this.height; y++) {
// 				let index = x + y * this.width
// 				nodes.push(this.switches[index])

// 				if (nodes.length > maxCount) {
// 					return nodes
// 				}
// 			}
// 		}

// 		return nodes
// 	}
// }




// class Renderer {
// 	canvas?: HTMLElement
// 	width: number
// 	height: number
// 	nodes: SwitchLevel[]
// 	zoomLevel: number = 2.5
// 	totalLevels: number = 0
// 	baseSize: number = 200
// 	zoomLevelToSizeMap: Map<number, [number, number, number]> = new Map();

// 	constructor(canvas?: HTMLElement) {
// 		this.canvas = canvas;
// 		this.width = 1024
// 		this.height = 1024

// 		let width = this.width
// 		let height = this.height
// 		this.nodes = []
// 		let level = 0
// 		while (width > 1 && height > 1) {
// 			let currLevelNodes = new SwitchLevel(level)

// 			for (let i = 0; i < height; i++) {
// 				for (let j = 0; j < width; j++) {
// 					currLevelNodes.addSwitch(new Switch(j, i, level))
// 				}
// 			}
// 			width /= 2
// 			height /= 2
// 			level += 1

// 			this.nodes.push(currLevelNodes)
// 		}

// 		this.totalLevels = level
// 		this.calculateNodeSize()
// 	}

// 	calculateNodeSize() {
// 		let nodeSize = this.baseSize
// 		let gapSize = this.baseSize / 2
// 		let offset = gapSize
// 		this.zoomLevelToSizeMap.set(0, [nodeSize, gapSize, offset])

// 		for (let level = 1; level < this.totalLevels; level++) {
// 			nodeSize = nodeSize * 2 + gapSize * 2
// 			gapSize = nodeSize / 2
// 			offset = offset
// 			this.zoomLevelToSizeMap.set(level, [nodeSize, gapSize, offset])
// 		}
// 	}

// 	zoom(delta: number) {
// 		this.zoomLevel -= delta
// 		if (this.zoomLevel < 1) {
// 			this.zoomLevel = 1
// 		}

// 		console.log(`Zoom level: ${this.zoomLevel}`)
// 		this.render()
// 	}

// 	render() {
// 		let mainZoomLevel = Math.round(this.zoomLevel)
// 		let levelsToDisplay = this.nodes.slice(
// 			mainZoomLevel - 1, mainZoomLevel + 2).reverse()
// 		if (levelsToDisplay.length == 0) {
// 			if (mainZoomLevel < 2) {
// 				levelsToDisplay.push(this.nodes[0])
// 			} else {
// 				levelsToDisplay.push(this.nodes[this.nodes.length - 1])
// 			}
// 		}

// 		let levels = d3.select(this.canvas!)
// 			.selectAll<SVGGElement, SwitchLevel>('g')
// 			.data(levelsToDisplay, (d: SwitchLevel) => d.level)

// 		let newLevels = levels.enter()
// 			.append('g')
// 			.attr('zoom-level', (d: SwitchLevel) => d.level)

// 		newLevels.merge(levels).each((d, i, levels) => {
// 			this.renderNodesInLevel(d, levels[i])
// 		})

// 		levels.exit().remove()
// 	}

// 	calculateLevelSize(
// 		level: number,
// 	): number[] {
// 		let dominatingLevel = Math.ceil(this.zoomLevel)
// 		let levelDiff = dominatingLevel - this.zoomLevel
// 		const baseSize = this.baseSize * (3.3 ** levelDiff)

// 		let gapSizes = [0, 0, 0, 0, baseSize * .1]
// 		let nodeSize = baseSize * .9

// 		for (let l = dominatingLevel; l >= level; l--) {
// 			let gapSize = nodeSize / 2 * .2
// 			gapSizes.push(gapSize)

// 			nodeSize = nodeSize / 2 * .8
// 		}

// 		console.log(`ZoomLevel: ${this.zoomLevel}, Curr Level: ${level}, Sizes: ${nodeSize}, ${gapSizes}`)
// 		// const baseSize = this.baseSize ** (1 / this.zoomLevel) / this.zoomLevel
// 		// console.log(baseSize)

// 		// let levelSize = baseSize
// 		// for (let i = 0; i < level; i++) {
// 		// 	levelSize *= 2
// 		// }

// 		// const ratio = 1 - 1 / this.zoomLevel
// 		// const nodeSize = levelSize * ratio
// 		// const gapSize = levelSize * (1 - ratio)
// 		// const offsetSize = 0

// 		return [nodeSize,
// 			gapSizes[gapSizes.length - 1],
// 			gapSizes[gapSizes.length - 2],
// 			gapSizes[gapSizes.length - 3],
// 			gapSizes[gapSizes.length - 4],
// 			0
// 		]
// 	}

// 	// calculateMainLevelSize(level: number): [number, number, number] {
// 	// 	let baseSize = 100
// 	// 	let levelDiff = level - this.zoomLevel
// 	// 	let scaleCoeff = 3.3
// 	// 	let levelSize = baseSize * Math.pow(scaleCoeff, levelDiff)

// 	// 	return [levelSize * .5, levelSize * .5, levelSize]
// 	// }

// 	// calculateAboveLevelSize(level: number): [number, number, number] {
// 	// 	let [baseSize, baseGap, baseOffset] = this.calculateLevelSize(level - 1)

// 	// 	let baseLevelSize = baseSize + baseGap
// 	// 	let levelSize = baseLevelSize * 2

// 	// 	return [levelSize * .9, levelSize * .1, baseOffset - 0.25 * baseGap]
// 	// }


// 	renderNodesInLevel(
// 		level: SwitchLevel, container: SVGGElement,
// 	) {
// 		let [nodeSize, gapSize, twoGapSize, fourGapSize, eightGapSize, offsetSize] =
// 			this.calculateLevelSize(level.level)
// 		let levelSize = nodeSize + gapSize

// 		let canvas = document.getElementById('canvas')
// 		let canvasWidth = canvas!.clientWidth
// 		let canvasHeight = canvas!.clientHeight
// 		let leftCoord = 0
// 		let topCoord = 0
// 		let rightCoord = canvasWidth / levelSize
// 		let bottomCoord = canvasHeight / levelSize

// 		let nodesToDisplay = level.filter(
// 			leftCoord, rightCoord,
// 			topCoord, bottomCoord,
// 		)

// 		let nodeList = d3.select(container)
// 			.selectAll<SVGRectElement, Switch>('rect')
// 			.data(nodesToDisplay, (d: Switch) => `${d.x}-${d.y}-${d.zoomLevel}`)

// 		let newNodes = nodeList.enter()
// 			.append('rect')
// 		// .attr('x', (d: Switch) => {
// 		// 	return d.x * levelSize + d.x / 2 * twoGapSize + d.x / 4 * fourGapSize + offsetSize
// 		// })
// 		// .attr('y', (d: Switch) => {
// 		// 	return d.y * levelSize + d.y / 2 * twoGapSize + d.y / 4 * fourGapSize + offsetSize
// 		// })
// 		// .attr('width', nodeSize)
// 		// .attr('height', nodeSize)
// 		// .attr('fill', '#99d8c9')
// 		// .attr('stroke', '#000000')
// 		// .attr('stroke-width', 3)

// 		newNodes.merge(nodeList)
// 			.transition()
// 			.duration(200)
// 			.attr('x', (d: Switch) => {
// 				return d.x * levelSize +
// 					Math.floor(d.x / 2) * twoGapSize +
// 					Math.floor(d.x / 4) * fourGapSize +
// 					Math.floor(d.x / 8) * eightGapSize +
// 					offsetSize
// 			})
// 			.attr('y', (d: Switch) => {
// 				return d.y * levelSize +
// 					Math.floor(d.y / 2) * twoGapSize +
// 					Math.floor(d.y / 4) * fourGapSize +
// 					Math.floor(d.y / 8) * eightGapSize +
// 					offsetSize
// 			})
// 			.attr('width', nodeSize)
// 			.attr('height', nodeSize)
// 			.attr('fill', '#99d8c9')
// 			.attr('stroke', '#000000')
// 			.attr('stroke-width', 3)
// 			.attr('opacity', (d: Switch) => {
// 				if (this.zoomLevel > 10) {
// 					return 1
// 				}

// 				if (Math.abs(d.zoomLevel - this.zoomLevel) < 1) {
// 					return 1
// 				}

// 				return (2 - Math.abs(d.zoomLevel - this.zoomLevel)) / 2 + 0.5
// 			})


// 		nodeList.exit().remove();
// 	}
// }

// let r = new Renderer(document.getElementById('grid')!);
// r.render();

// document.getElementById('canvas')!
// 	.addEventListener('wheel', (e: WheelEvent) => {
// 		r.zoom(e.deltaY / 3000)
// 	})

