.PHONY: test test-v test-suite test-js

# Quiet: dots + summary only (agent-friendly, writes .claude/test-results/)
test:
	python3 -m pytest tests/integration/ -q

# Verbose: every test name with PASSED/FAILED
test-v:
	python3 -m pytest tests/integration/ -v

# Single suite by keyword  e.g.  make test-suite SUITE=charger
test-suite:
	python3 -m pytest tests/integration/ -k "$(SUITE)" -v

# Run legacy JS tests (kept for reference)
test-js:
	node tests/integration/run.js
