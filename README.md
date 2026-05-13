# Gemma CLI

A local-first terminal interface for Gemma 4 models, built to avoid cloud quotas and costs.

## Prerequisites

- [Ollama](https://ollama.com/) installed and running.
- Gemma 4 model pulled: `ollama pull gemma4` (or your preferred variant).

## Installation

```bash
# From the project root
npm install
npm run build
```

## Usage

### Interactive Mode (REPL)
```bash
npm start
```

### Single Prompt
```bash
npm start -- -p "What is the capital of France?"
```

### Specify Model
```bash
npm start -- -m gemma4:27b -p "Explain quantum entanglement"
```

## Features

- **Local-First:** All processing happens on your machine via Ollama.
- **Streaming Output:** Real-time responses.
- **Persistent History:** Interactive mode maintains conversation context.
- **No Quotas:** Use the model as much as your hardware allows.
