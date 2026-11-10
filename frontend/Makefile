# Release mechanics for @arrayscape/react-file-manager.
#
# The registry is not named here -- publishConfig in package.json routes the
# publish to GitHub Packages. This file only supplies the token, and only for
# the npm process that needs it:
#
#   NPM_GITHUB_TOKEN=$$(gh auth token) npm ...
#
# is a shell prefix assignment, so the token is set in that process's
# environment and nowhere else. Two things it deliberately is not:
#
#   $(shell gh auth token)        would run at parse time and leave the token
#                                 sitting in make's memory for the whole run.
#   env 'npm_config_...=TOKEN'    works too, but puts the token in argv where
#                                 ps can read it.
#
# `npm publish` runs prepublishOnly, which rebuilds dist/, so publish does not
# depend on build here.

TAG := arrayscape
FIXTURES_URL := http://localhost:5173

.PHONY: all build test test-browser pack publish clean

all: build

build:
	npm run build

# Behaviour, under jsdom: fast, and blind to layout. Anything about where an
# element actually lands cannot be asserted here -- jsdom reports every
# getBoundingClientRect as zeroes -- and lives in test/browser/ instead.
test:
	npm test

# The geometric assertions jsdom cannot make, in a real Chrome against the
# fixture app in dev/. Starts vite, runs them, and stops vite whether they
# passed or not -- including anything still holding the port, because `kill`
# on npm does not always take the vite it spawned with it.
#
# Needs python3 with `websockets` (pip install websockets); Chrome is found
# and driven by test/browser/cdp.py.
test-browser:
	@npm run dev >/tmp/rfm-fixtures.log 2>&1 & \
	  for i in $$(seq 1 40); do \
	    curl -sf -o /dev/null $(FIXTURES_URL)/dev/ && break; sleep 0.25; \
	  done; \
	  FIXTURES_URL=$(FIXTURES_URL) python3 -I test/browser/geometry.py; rc=$$?; \
	  lsof -ti tcp:$${FIXTURES_URL##*:} 2>/dev/null | xargs kill 2>/dev/null; \
	  lsof -ti tcp:5173 2>/dev/null | xargs kill 2>/dev/null; \
	  exit $$rc

# Exactly what `publish` would send, without sending it. Contacts no registry.
pack:
	npm publish --dry-run --tag $(TAG)

# npm refuses to publish a prerelease (1.5.6-arrayscape.1) without an explicit
# --tag, and refuses to overwrite a version that already exists -- so bump the
# version in package.json for every release.
# Tests first: every change reaches the dashboard by being published, so a
# publish is the only gate there is.
publish: test
	@test -z "$$(git status --porcelain .)" || \
		{ echo "refusing to publish: uncommitted changes here, so the artifact would not be reproducible"; exit 1; }
	NPM_GITHUB_TOKEN=$$(gh auth token) npm publish --tag $(TAG)

clean:
	rm -rf dist
