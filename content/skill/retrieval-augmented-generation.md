---
title: Retrieval-Augmented Generation
summary: GraphRAG-style retrieval over a hand-authored knowledge graph with cited answers.
category: practice
aliases: [RAG, GraphRAG, vector search, embeddings]
---

Retrieval-augmented generation done GraphRAG-style: embed nodes and edges of a typed knowledge graph, seed by vector similarity, expand over weighted edges, budget the context, and make one streamed LLM call whose inline citations are validated server-side.
