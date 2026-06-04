-- Add pgvector extension and embedding column
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to user_context_embeddings table
ALTER TABLE "user_context_embeddings" 
ADD COLUMN IF NOT EXISTS "embedding" vector(768);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS "user_context_embeddings_embedding_idx" 
ON "user_context_embeddings" 
USING ivfflat ("embedding" vector_cosine_ops)
WITH (lists = 100);
