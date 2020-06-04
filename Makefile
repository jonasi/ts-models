.PHONY: build watch clean test test_watch

build:
	./node_modules/.bin/tsc
	./node_modules/.bin/webpack --entry ./dist/bin/index.js --output ./dist/bin.js --target node --mode production --optimize-minimize false --progress --colors

watch:
	./node_modules/.bin/tsc --watch

clean:
	rm -rf dist

test:
	./node_modules/.bin/jest

test_watch:
	./node_modules/.bin/jest --watch
