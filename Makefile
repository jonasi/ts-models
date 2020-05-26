.PHONY: build watch clean test test_watch

build:
	./node_modules/.bin/tsc

watch:
	./node_modules/.bin/tsc --watch

clean:
	rm -rf dist

test:
	./node_modules/.bin/jest

test_watch:
	./node_modules/.bin/jest --watch
