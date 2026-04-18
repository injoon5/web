# Markdown Negotiation

This site supports content negotiation to return Markdown instead of HTML.

## Usage

Add `Accept: text/markdown` to any page request.

## Response Headers

- `Content-Type: text/markdown; charset=utf-8`
- `x-markdown-tokens`: approximate token count of the Markdown body
