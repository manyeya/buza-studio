# Buza Studio API Documentation

This API provides access to the Buza Studio project system for external applications like Chrome extensions.

## Base URL

The API runs on a dynamic port. Check the server output for the port number:
```
PORT:12345
```

Then use: `http://localhost:12345`

## Data Storage

Projects are stored in: `~/buza-projects/`

## API Endpoints

### Projects

#### List all projects
```http
GET /api/projects
```

**Response:**
```json
{
  "projects": ["Project 1", "Project 2"]
}
```

#### Create a new project
```http
POST /api/projects
Content-Type: application/json

{
  "name": "My New Project"
}
```

**Response:**
```json
{
  "success": true,
  "name": "My New Project"
}
```

#### Get project details
```http
GET /api/projects/:projectName
```

**Response:**
```json
{
  "name": "My Project",
  "path": "/path/to/project",
  "variants": [...],
  "variables": [...],
  "description": "Project description",
  "createdAt": 1234567890,
  "updatedAt": 1234567890
}
```

#### Delete a project
```http
DELETE /api/projects/:projectName
```

#### Update project description
```http
PUT /api/projects/:projectName/description
Content-Type: application/json

{
  "description": "New description"
}
```

#### Rename a project
```http
PUT /api/projects/:projectName/rename
Content-Type: application/json

{
  "newName": "New Project Name"
}
```

---

### Variants

#### List variants in a project
```http
GET /api/projects/:projectName/variants
```

**Response:**
```json
{
  "variants": ["Main", "Variant 1", "Variant 2"]
}
```

#### Create a new variant
```http
POST /api/projects/:projectName/variants
Content-Type: application/json

{
  "name": "New Variant",
  "content": "Prompt template content here",
  "metadata": {
    "model": "gemini-2.5-flash",
    "temperature": 0.7,
    "maxTokens": 1000
  }
}
```

#### Get a specific variant
```http
GET /api/projects/:projectName/variants/:variantName
```

**Response:**
```json
{
  "name": "Main",
  "path": "/path/to/variant.md",
  "metadata": {
    "model": "gemini-2.5-flash",
    "temperature": 0.7
  },
  "content": "Prompt template content"
}
```

#### Update a variant
```http
PUT /api/projects/:projectName/variants/:variantName
Content-Type: application/json

{
  "content": "Updated prompt template",
  "metadata": {
    "model": "gemini-2.5-flash",
    "temperature": 0.8
  }
}
```

#### Delete a variant
```http
DELETE /api/projects/:projectName/variants/:variantName
```

#### Rename a variant
```http
PUT /api/projects/:projectName/variants/:variantName/rename
Content-Type: application/json

{
  "newName": "New Variant Name"
}
```

---

### Variables

#### Get project variables
```http
GET /api/projects/:projectName/variables
```

**Response:**
```json
{
  "variables": [
    {
      "id": "var-1",
      "key": "language",
      "value": "TypeScript"
    }
  ]
}
```

#### Update project variables
```http
PUT /api/projects/:projectName/variables
Content-Type: application/json

{
  "variables": [
    {
      "id": "var-1",
      "key": "language",
      "value": "TypeScript"
    }
  ]
}
```

#### Get variable library (global variables)
```http
GET /api/library/variables
```

#### Update variable library
```http
PUT /api/library/variables
Content-Type: application/json

{
  "variables": [...]
}
```

---

### Templates

#### Get template library
```http
GET /api/templates
```

**Response:**
```json
{
  "templates": [
    {
      "name": "Text Summarizer",
      "description": "Condense long text into concise bullet points.",
      "content": "Template content...",
      "config": {
        "model": "gemini-2.5-flash",
        "temperature": 0.3
      },
      "variables": [...],
      "projectVariables": [...]
    }
  ]
}
```

#### Update template library
```http
PUT /api/templates
Content-Type: application/json

{
  "templates": [...]
}
```

---

### Utility Endpoints

#### Health check
```http
GET /health
```

**Response:**
```json
{
  "healthy": true
}
```

#### Server status
```http
GET /api/status
```

**Response:**
```json
{
  "status": "running",
  "uptime": 123.45,
  "timestamp": "2025-11-26T14:27:32.000Z",
  "dataPath": "/Users/username/buza-projects"
}
```

#### Hello (test endpoint)
```http
GET /api/hello
```

**Response:**
```json
{
  "message": "Hello from Bun!"
}
```

---

## CORS

All endpoints support CORS with the following headers:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type`

This allows the API to be accessed from Chrome extensions and web applications.

---

## Chrome Extension Example

```javascript
// In your Chrome extension
const API_BASE = 'http://localhost:12345'; // Replace with actual port

// List all projects
async function getProjects() {
  const response = await fetch(`${API_BASE}/api/projects`);
  const data = await response.json();
  return data.projects;
}

// Create a new project
async function createProject(name) {
  const response = await fetch(`${API_BASE}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  return await response.json();
}

// Get a variant
async function getVariant(projectName, variantName) {
  const response = await fetch(
    `${API_BASE}/api/projects/${encodeURIComponent(projectName)}/variants/${encodeURIComponent(variantName)}`
  );
  return await response.json();
}
```

---

## Error Handling

All endpoints return errors in the following format:

```json
{
  "error": "Error message here"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (missing required fields)
- `404` - Not Found
- `500` - Internal Server Error
