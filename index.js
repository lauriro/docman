
process.chdir( process.env.PWD )

//console.log(process)
var exec = require('child_process').exec
var spawn = require("child_process").spawn
, fs = require('fs')
, conf = require( process.env.PWD + '/package.json').docman || {}

!function(root){
	var tick = root.process && root.process.nextTick || setTimeout

	function async(fn) {
		var t = this
		t.pending = 0
		t.cb = function() {
			tick(function(){--t.pending==0&&fn()}, 0)
		}
	}

	async.prototype.wait = function(next) {
		var t = this
		t.pending++
		return next ? 
			function() {
				next.apply(this, arguments)
				t.cb()
			} :
			t.cb
	}
	root.async = async
}(this)

var async = this.async

function title(text, line) {
	return "\n" + text + "\n" + text.replace(/./g, line || "=") + "\n"
}


function authors() {
	exec('git shortlog -sen < /dev/tty', function(err, stdout, stderr) {
		if (!err) {
			console.log("\nAuthors ordered by number of commits.\n")
			console.log(stdout.replace(/^\s*(\d+)\s*(.*)$/mg, "  * $2 ($1)"))
		}
	});
}

function tag_title(hash, next) {
	exec('git describe --tags --exact-match ' + hash, function(err, name, stderr) {
		if (err) return next('no name')
		exec('git log --format="%ci" -1 ' + hash, function(err, date, stderr) {
			if (err) return next('no date')
			next(null, title(date.split(' ')[0] + ' version ' + name.replace(/\n/, ''), '-') )
		})
	})
}

function lineEmitter(options) {
	options = options || {}

	var leftover = ""
	, separator = options.separator || /\r?\n/
	, event = options.event || "line"

	return function(data){
		var lines = (leftover + data).split(separator)

		// keep the last partial line buffered
		leftover = lines.pop()

		for (var i = 0, len = lines.length; i < len; ) {
			this.emit(event, lines[i++])
		}
	}
}

function ChangeLog() {
	var tag
	, out = []
	, skip = []
	, git = spawn("git", ["log", "--no-merges", "--pretty=tformat:%h %d?  * %s (%aN)"])
	

	var ready = new async(function(){
		console.log( title("ChangeLog") )

		for (var i = skip.length; i--; )
			out.splice(skip[i], 1)
		
		console.log( out.join("\n") )
	})



	git.stdout.on("data", lineEmitter())

	git.stdout.on("line", function(line) {
		line.replace(/^(.+?) (.*?)\?(.+)$/, function(_, h, t, m) {
			if (t) {
				var replace = out.length
				out.push( " - REPLACE - " )
				tag_title(h, ready.wait(function(err, title) {
					if (err) {
						skip.push(replace)
						return
					}
					
					out[replace] = title
				}))
			}
			out.push(m)
		} )
	});
	git.stderr.on('data', function (data) {
		  console.error('stderr: ' + data);
	});

	git.on("close", ready.wait())
	

}


	/*
var spawn = require("child_process").spawn

//require("liquid-filters-lite")




function authors() {
	var out = []
	, git = spawn("git", ["shortlog", "-sen"])


	git.stdout.on("data", function(data) {
		console.log("data " + data)
	})
	git.stderr.on('data', function (data) {
		  console.log('stderr: ' + data);
	});
	git.on("end", function(){
		console.log("\nAuthors ordered by number of commits.\n\n")
	
	})
}

*/
//authors()

function readme() {

}

function buildAll() {
	authors()
	ChangeLog()
	readme()
}

var map = {
	"AUTHORS": authors,
	"ChangeLog": ChangeLog,
	"README.md": readme,
	"--all": buildAll
}

function invalidTarget(name) {
	console.error("ERROR: invalid target " + name)
}

for (var i = 2, val; val = process.argv[i++]; ) {
	;( map[val] || invalidTarget )(val)
};

