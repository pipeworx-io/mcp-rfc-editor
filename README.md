# @pipeworx/rfc-editor

[RFC Editor](https://www.rfc-editor.org) MCP — fetch full RFC text + metadata directly from rfc-editor.org (complementary to `ietf-datatracker` which deals in metadata). Keyless.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

- `rfc_text(number)` — full RFC plain text
- `rfc_metadata(number)` — RFC index entry metadata (title, authors, status, obsoletes/updates)
- `errata(number?)` — known errata (per-RFC or all)
- `bcp(number)` — Best Current Practice mapping (BCP → RFC list)
- `std(number)` — STD mapping (STD → RFC list)
- `search(query, status?)` — substring search in title/abstract via rfc-editor index

## Data source

`https://www.rfc-editor.org/rfc/rfc<N>.txt` etc., plus the rfc-index.xml + errata feed.

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "rfc-editor": {
      "url": "https://gateway.pipeworx.io/rfc-editor/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Rfc Editor data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
