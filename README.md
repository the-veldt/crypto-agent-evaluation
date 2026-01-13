# Crypto Agent Evaluation

An evaluation framework for testing and comparing crypto-focused search systems and AI agents. Built to measure the quality of search results and agent task completion using LLM-based evaluation.

## Features

- **Search Evaluation**: Compare search quality across multiple providers
  - Droyd Search (crypto-specific)
  - Exa Search (general web)
- **Agent Evaluation**: Compare AI agent performance on crypto tasks
  - Standard model agents (GPT-5, Gemini-3-flash) with webSearch tool
  - Droyd Agent (specialized crypto agent)
    - droyd: Default Droyd agent
    - droyd-casual: Droyd casual tier
    - droyd-pro: Droyd pro tier
- **LLM-based Judging**: Automated evaluation using Claude, GPT, or Gemini models
- **Multi-dimensional Scoring**:
  - Search: Evaluates on relevance, quality, information density, and completeness
  - Agents: Evaluates on task completion, answer quality, reasoning quality, and efficiency
- **Flexible Dataset Loading**: Load single, multiple, or all dataset files
- **Comprehensive Results**: Stores raw responses, execution traces, evaluations, and summary statistics

## Prerequisites

- Node.js 20+
- npm or yarn
- API Keys (required based on what you're testing):
  - **Judge Models:**
    - `ANTHROPIC_API_KEY` - For Claude models (recommended judge)
    - `GOOGLE_GENERATIVE_AI_API_KEY` - For Gemini models
    - `OPENAI_API_KEY` - For GPT models
  - **Search Systems:**
    - `DROYD_API_KEY` - For Droyd crypto search
    - `EXA_API_KEY` - For Exa web search
  - **Agent Systems:**
    - `DROYD_API_KEY` - For Droyd agent (required for all Droyd tiers)
    - `DROYD_USER_ID` - For default Droyd agent (optional)
    - `DROYD_CASUAL_USER` - User ID for Droyd casual tier (required when using droyd-casual)
    - `DROYD_PRO_USER` - User ID for Droyd pro tier (required when using droyd-pro)
    - `OPENAI_API_KEY` - For GPT-5 agent
    - `GOOGLE_GENERATIVE_AI_API_KEY` - For Gemini agent

## Setup

1. **Clone and install dependencies:**

```bash
git clone <repository-url>
cd crypto-agent-evaluation
npm install
```

2. **Configure environment variables:**

Create a `.env.local` file in the project root:

```bash
# Judge Model (at least one required)
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_GENERATIVE_AI_API_KEY=...
OPENAI_API_KEY=sk-...

# Search Systems (required for search evaluation)
DROYD_API_KEY=...
EXA_API_KEY=...

# Agent Systems (required for agent evaluation)
DROYD_API_KEY=...
DROYD_USER_ID=1                # Optional: default Droyd user
DROYD_CASUAL_USER=1            # Required for droyd-casual
DROYD_PRO_USER=2               # Required for droyd-pro
```

## Running Search Evaluations

### Basic Usage

Run evaluations with default settings (all datasets, both search systems):

```bash
npm run eval:search
```



### Configuration Options

```bash
# Evaluate specific dataset
npm run eval:search -- --dataset assetDiscovery

# Evaluate multiple datasets
npm run eval:search -- --dataset assetDiscovery,assetEvaluation

# Load all datasets (default)
npm run eval:search -- --dataset all

# Test single search system
npm run eval:search -- --system droyd
npm run eval:search -- --system exa

# Customize search parameters
npm run eval:search -- --limit 15 --days-back 7

# Droyd-specific options
npm run eval:search -- --droyd-mode semantic

# Exa-specific options
npm run eval:search -- --exa-max-chars 3000

# Show all options
npm run eval:search -- --help
```

### CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--dataset <name>` | Dataset file(s): single, multiple (comma-separated), or `all` | `all` |
| `--system <type>` | Search system(s): `droyd`, `exa`, or `both` | `both` |
| `--limit <number>` | Max results per search | `10` |
| `--days-back <number>` | Search last N days | `30` |
| `--output-dir <path>` | Results output directory | `datasets/_results/search` |
| `--droyd-mode <mode>` | Droyd search mode: `recent` or `semantic` | `semantic` |
| `--exa-max-chars <num>` | Max characters for Exa text | `2000` |
| `--help, -h` | Show help message | - |

## Running Agent Evaluations

### Basic Usage

Run agent evaluations with default settings (all datasets, all agent systems):

```bash
npm run eval:agent
```

### Configuration Options

```bash
# Evaluate specific dataset
npm run eval:agent -- --dataset assetDiscovery

# Evaluate multiple datasets
npm run eval:agent -- --dataset assetDiscovery,anotherDataset

# Load all datasets (default)
npm run eval:agent -- --dataset all

# Test specific agent systems
npm run eval:agent -- --systems gpt-5,droyd
npm run eval:agent -- --systems gemini-3-flash

# Test Droyd subscription tiers
npm run eval:agent -- --systems droyd-casual,droyd-pro
npm run eval:agent -- --systems droyd,droyd-casual,droyd-pro

# Customize agent parameters
npm run eval:agent -- --max-steps 5

# Show all options
npm run eval:agent -- --help
```

### CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--dataset <name>` | Dataset file(s): single, multiple (comma-separated), or `all` | `all` |
| `--systems <systems>` | Agent systems to test (comma-separated): `gpt-5`, `gpt-5-mini`, `claude-4.5-sonnet`, `gemini-3-flash`, `droyd`, `droyd-casual`, `droyd-pro` | All systems |
| `--max-steps <number>` | Max steps for standard agents (GPT/Gemini) | `10` |
| `--output-dir <path>` | Results output directory | `datasets/_results/agent` |
| `--help, -h` | Show help message | - |

## Project Structure

```
crypto-agent-evaluation/
├── datasets/
│   ├── search/              # Search evaluation datasets
│   │   ├── assetDiscovery.json
│   │   └── assetEvaluation.json
│   ├── agent/               # Agent evaluation datasets
│   │   └── assetDiscovery.json
│   ├── _results/            # Evaluation results (auto-generated)
│   │   ├── search/
│   │   └── agent/
│   └── types/               # TypeScript type definitions
│
├── lib/
│   ├── evaluation/
│   │   ├── search/          # Search evaluation engine
│   │   │   ├── types.ts
│   │   │   ├── defaultConfig.ts
│   │   │   ├── searchExecutor.ts
│   │   │   ├── searchResultFormatter.ts
│   │   │   ├── evaluateSearchResult.ts
│   │   │   └── runSearchEvaluation.ts
│   │   └── agent/           # Agent evaluation engine
│   │       ├── types.ts
│   │       ├── defaultConfig.ts
│   │       ├── agentExecutor.ts
│   │       ├── agentResultFormatter.ts
│   │       ├── evaluateAgentResult.ts
│   │       └── runAgentEvaluation.ts
│   ├── utils/
│   │   ├── droydSearch.ts   # Droyd search API
│   │   ├── droydTask.ts     # Droyd agent API
│   │   └── webSearch.ts     # Exa search API
│   └── agents/
│       └── agentFactory/    # Agent creation and configuration
│           ├── agentFactory.ts
│           ├── models.ts
│           └── tools/
│
└── scripts/
    ├── eval-search.ts       # Search evaluation CLI
    └── eval-agent.ts        # Agent evaluation CLI
```

## Creating Datasets

### Search Datasets

Add new search evaluation questions by creating JSON files in `datasets/search/`:

```json
[
  {
    "qid": "unique-id",
    "query": "your evaluation question",
    "level": 1,
    "categories": ["asset_discovery"],
    "tags": ["large_cap"],
    "sectors": ["defi"]
  }
]
```

**Dataset Schema:**
- `qid` - Unique question identifier
- `query` - The search query to evaluate
- `level` - Difficulty level (1-3)
- `categories` - Type of question: `asset_discovery`, `asset_analysis`, `trend_discovery`, `trend_analysis`, `onchain_fundamentals`
- `tags` - Market cap: `large_cap`, `middle_market`, `small_cap`
- `sectors` - Crypto sectors: `defi`, `ecosystems`, `ai`, `memecoins`, `prediction_markets`, `consumer`, `stablecoins`

### Agent Datasets

Add new agent evaluation questions by creating JSON files in `datasets/agent/`:

```json
[
  {
    "qid": "unique-id",
    "query": "your agent task query",
    "level": 1,
    "categories": ["asset_discovery"],
    "tags": null,
    "sectors": null
  }
]
```

Agent datasets use the same schema as search datasets. The query should describe a task that requires the agent to use tools (like web search) to complete.

## Evaluation Results

### Search Evaluation Results

Results are saved to `datasets/_results/search/` in JSON format.

**Filename format:** `search-eval-{dataset}-{timestamp}.json`

**Contents:**
- Full configuration used
- Per-question results with:
  - Original question metadata
  - Raw search responses from each system
  - Formatted search contents sent to judge
  - Detailed evaluation scores (0-10 scale):
    - Query Relevance
    - Search Contents Quality
    - Relevant Information Density
    - Completeness
    - Overall Score
  - Reasoning for each score
  - Key strengths and weaknesses
  - Execution times
- Summary statistics with average scores per system

### Agent Evaluation Results

Results are saved to `datasets/_results/agent/` in JSON format.

**Filename format:** `agent-eval-{dataset}-{timestamp}.json`

**Contents:**
- Full configuration used
- Per-question results with:
  - Original question metadata
  - Agent execution traces (all steps, tool calls, reasoning)
  - Final answers from each agent
  - Detailed evaluation scores (0-10 scale):
    - Task Completion
    - Answer Quality
    - Reasoning Quality
    - Efficiency
    - Overall Score
  - Reasoning for each score
  - Key strengths and weaknesses
  - Execution metadata (time, steps, tokens)
- Summary statistics with:
  - Average scores per system
  - Average execution time per system
  - Average steps per system

## Configuration

### Search Evaluation

Default configuration is in [lib/evaluation/search/defaultConfig.ts](lib/evaluation/search/defaultConfig.ts). You can modify:

- Search systems to test
- Dataset files to load
- Judge model (Claude, GPT, Gemini)
- Search parameters (limit, days back, relevance thresholds)
- Output directory

### Agent Evaluation

Default configuration is in [lib/evaluation/agent/defaultConfig.ts](lib/evaluation/agent/defaultConfig.ts). You can modify:

- Agent systems to test (GPT-5, GPT-5-mini, Claude-4.5-sonnet, Gemini-3-flash, Droyd, Droyd-casual, Droyd-pro)
- Dataset files to load
- Judge model (Claude, GPT, Gemini)
- Agent parameters (tools, max steps, instructions)
- Output directory

**Droyd Subscription Tiers:**
- `droyd`: Default Droyd agent (uses `DROYD_USER_ID` or no user ID)
- `droyd-casual`: Droyd casual tier (requires `DROYD_CASUAL_USER` env var)
- `droyd-pro`: Droyd pro tier (requires `DROYD_PRO_USER` env var)

## Development

```bash
# Install dependencies
npm install

# Run Next.js development server (for future UI)
npm run dev

# Run search evaluations
npm run eval:search

# Run agent evaluations
npm run eval:agent

# Lint code
npm run lint
```

## Architecture

### Search Evaluation Pipeline

1. **CLI Script** → Parses arguments and loads configuration
2. **Core Engine** → Orchestrates evaluation process
3. **Search Executors** → Calls Droyd/Exa APIs
4. **Result Formatter** → Formats raw JSON for LLM evaluation
5. **Evaluator** → Uses LLM to judge search quality
6. **Result Storage** → Saves comprehensive results to JSON

### Agent Evaluation Pipeline

1. **CLI Script** → Parses arguments and loads configuration
2. **Core Engine** → Orchestrates evaluation process
3. **Agent Executors** → Runs agents (standard models via agentFactory, Droyd via droydTask)
4. **Result Formatter** → Formats agent execution traces for LLM evaluation
5. **Evaluator** → Uses LLM to judge agent performance
6. **Result Storage** → Saves comprehensive results with execution traces to JSON

**Key Difference:** Agent evaluation captures multi-step execution traces including reasoning, tool calls, and intermediate results, while search evaluation captures single API call responses.

## License

MIT
