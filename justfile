# justfile for interview API curl commands

# Create a new interview
create-interview:
  curl -X POST http://localhost:8787/api/v1/interviews \
    -H "Content-Type: application/json" \
    -H "Cookie: username=testuser; HttpOnly" \
    -d '{"title":"Frontend Developer Interview","skills":["JavaScript","React","CSS"]}'

# Get all interviews
get-interviews:
  curl http://localhost:8787/api/v1/interviews \
    -H "Cookie: username=testuser; HttpOnly"
