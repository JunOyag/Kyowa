module.exports = {
	globDirectory: 'build/',
	globPatterns: [
		'**/*.{json,png,jpg,jpeg,html,txt,css,js,woff2,svg,woff,ttf,eot}'
	],
	swDest: 'build/sw.js',
	ignoreURLParametersMatching: [
		/^utm_/,
		/^fbclid$/
	]
};