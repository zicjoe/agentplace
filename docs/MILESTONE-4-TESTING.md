# Milestone 4 Testing

## Local gate

```powershell
pnpm install --frozen-lockfile
pnpm check
```

## Production acceptance

### Model selector

- Sign in.
- Open Manager, Worker and Job conversations.
- Confirm `AgentPlace Auto` appears by default.
- If both providers are configured, confirm explicit Gemini and OpenAI choices appear.
- Change a conversation model, send a request, refresh/sign out/sign in, and confirm the preference remains associated with that conversation.

### Real Manager intelligence

Ask:

> Research EigenLayer, Aave and Pendle and explain their current opportunities and important risks.

Expected:

- no fixture response;
- a durable research Job is created;
- a real AgentPlace Original Worker is selected;
- Job status becomes Working and later Completed;
- browser may be closed while work continues;
- research answer is source-grounded;
- Evidence sources appear in the Job Result tab;
- Job and answer restore after sign-in.

### Truthfulness / unavailable capability

Ask:

> Compare BONK, WIF and POPCAT and check smart-money activity and holder concentration.

Expected:

- AgentPlace may research current public sources;
- it must not invent holder analytics or wallet-clustering metrics when those dedicated capabilities are still planned;
- response should distinguish public evidence from unavailable specialist capability depth.

### Failure safety

- Temporarily configure an invalid provider key in a non-production test deployment.
- Submit a research Job.
- Job/request must remain durable and show failure/retry behavior rather than fake completion.
- No financial state changes are possible.

### Account isolation

- Submit research with Account A.
- Sign in as Account B.
- Account B cannot read Account A's task, Job, evidence, model preference or ModelRun data through scoped APIs.
