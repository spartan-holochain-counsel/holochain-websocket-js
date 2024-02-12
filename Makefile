.PHONY:			FORCE

#
# Building
#
build:			FORCE lib/node.js
lib/node.js:		node_modules src/*.ts
	rm -f lib/*.js
	npx tsc -t es2022 -m es2022 --moduleResolution node --esModuleInterop \
		--outDir lib -d --sourceMap src/node.ts


#
# Project
#
package-lock.json:	package.json
	touch $@
node_modules:		package-lock.json
	npm install
	touch $@

use-local-backdrop:
	cd tests; npm uninstall @spartan-hc/holochain-backdrop
	cd tests; npm install --save-dev ../../node-holochain-backdrop/
use-npm-backdrop:
	cd tests; npm uninstall @spartan-hc/holochain-backdrop
	cd tests; npm install --save-dev @spartan-hc/holochain-backdrop


#
# Testing
#
DEBUG_LEVEL	       ?= warn
TEST_ENV_VARS		= LOG_LEVEL=$(DEBUG_LEVEL)
MOCHA_OPTS		= -t 15000 -n enable-source-maps

test:				test-integration	test-e2e
test-debug:			test-integration-debug	test-e2e-debug

test-integration:	build
	$(TEST_ENV_VARS) npx mocha $(MOCHA_OPTS) ./tests/integration
test-integration-%:	build
	$(TEST_ENV_VARS) npx mocha $(MOCHA_OPTS) ./tests/integration/test_$*.js

test-e2e:		prepare-package build
	$(TEST_ENV_VARS) npx mocha $(MOCHA_OPTS) ./tests/e2e
test-e2e-%:		prepare-package build
	$(TEST_ENV_VARS) npx mocha $(MOCHA_OPTS) ./tests/e2e/test_$*.js

test-server:
	python3 -m http.server 8765


#
# Repository
#
clean-remove-chaff:
	@find . -name '*~' -exec rm {} \;
clean-files:		clean-remove-chaff
	git clean -nd
clean-files-force:	clean-remove-chaff
	git clean -fd
clean-files-all:	clean-remove-chaff
	git clean -ndx
clean-files-all-force:	clean-remove-chaff
	git clean -fdx


#
# NPM packaging
#
prepare-package:
	rm -f dist/*
	npx webpack
	MODE=production npx webpack
	gzip -kf dist/*.js
preview-package:	clean-files test prepare-package
	npm pack --dry-run .
create-package:		clean-files test prepare-package
	npm pack .
publish-package:	clean-files test prepare-package
	npm publish --access public .
