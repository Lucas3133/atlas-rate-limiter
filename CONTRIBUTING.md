# 🤝 Contributing to Atlas Rate Limiter

First off, thank you for considering contributing to Atlas Rate Limiter! It's people like you that make this project great.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Style Guidelines](#style-guidelines)
- [Community](#community)

---

## 📜 Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code. Please be respectful and inclusive.

### Our Standards

- **Be respectful**: Treat everyone with respect and kindness
- **Be constructive**: Provide helpful feedback
- **Be collaborative**: Work together to improve the project
- **Be inclusive**: Welcome people of all backgrounds

---

## 🎯 How Can I Contribute?

### 🐛 Reporting Bugs

Before creating a bug report, please check existing issues to avoid duplicates.

**Great bug reports include:**
- A clear and descriptive title
- Steps to reproduce the issue
- Expected vs actual behavior
- Environment details (Node version, OS, etc.)
- Error messages and logs

**Template:**
```markdown
## Bug Description
A clear description of the bug.

## Steps to Reproduce
1. Start the server with '...'
2. Make a request to '...'
3. See error

## Expected Behavior
What you expected to happen.

## Actual Behavior
What actually happened.

## Environment
- Node.js: v20.x
- OS: Windows 11
- Redis: Upstash
```

### 💡 Suggesting Features

We love new ideas! Please open an issue with:
- **Problem**: What problem does this solve?
- **Solution**: Your proposed solution
- **Alternatives**: Other solutions you considered
- **Examples**: Code examples or mockups if applicable

### 📝 Improving Documentation

Documentation improvements are always welcome:
- Fix typos or grammatical errors
- Add missing information
- Improve code examples
- Translate to other languages

### 🔧 Code Contributions

Ready to code? Here are some ideas:

**Good first issues:**
- Add more unit tests
- Improve error messages
- Add TypeScript types
- Optimize performance

**More advanced:**
- New rate limiting algorithms
- Database adapters (PostgreSQL, MongoDB)
- Clustering support
- GraphQL integration

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Redis (local or Upstash account)
- Git

### Fork and Clone

```bash
# Fork the repository on GitHub, then:
git clone https://github.com/YOUR_USERNAME/atlas-rate-limiter.git
cd atlas-rate-limiter
```

---

## 💻 Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your Redis URL
```

### 3. Run in Development

```bash
npm run dev
```

### 4. Run Tests

```bash
npm test
npm run test:load
```

### 5. Build Docker (Optional)

```bash
npm run docker:build
npm run docker:run
```

---

## 🔄 Pull Request Process

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Your Changes

- Write clear, commented code
- Add tests for new features
- Update documentation if needed

### 3. Commit Your Changes

We use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Features
git commit -m "feat: add sliding window algorithm"

# Bug fixes
git commit -m "fix: prevent memory leak in metrics"

# Documentation
git commit -m "docs: add Redis clustering guide"

# Performance
git commit -m "perf: optimize token bucket calculation"

# Refactoring
git commit -m "refactor: extract client identifier logic"
```

### 4. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then open a Pull Request on GitHub with:
- Clear title and description
- Reference any related issues
- Screenshots/GIFs for UI changes

### 5. Code Review

- Address reviewer feedback
- Keep PRs focused and small
- Be patient and respectful

---

## 📐 Style Guidelines

### JavaScript

- Use ES6+ features
- No semicolons (consistent with codebase)
- 4 spaces for indentation
- JSDoc comments for functions

```javascript
/**
 * Calculates token refill based on time elapsed
 * @param {number} lastRefill - Last refill timestamp
 * @param {number} refillRate - Tokens per second
 * @returns {number} Tokens to add
 */
function calculateRefill(lastRefill, refillRate) {
    const elapsed = Date.now() - lastRefill
    return Math.floor(elapsed / 1000 * refillRate)
}
```

### File Structure

```
src/
├── config/       # Configuration files
├── core/         # Core logic (Redis, algorithms)
├── middleware/   # Express middleware
└── utils/        # Utility functions
```

### Commit Messages

- Use present tense: "add feature" not "added feature"
- First line max 72 characters
- Reference issues: "fix: resolve race condition (#42)"

---

## 📊 Testing

### Unit Tests

```bash
npm test
```

### Load Tests

```bash
npm run test:load
```

### Manual Testing

```bash
# Test rate limiting
curl http://localhost:3000/api/public

# Test metrics
curl http://localhost:3000/metrics

# Test health
curl http://localhost:3000/health
```

---

## 🌐 Community

### Get Help

- 📖 [Documentation](README.md)
- 💬 [GitHub Discussions](https://github.com/Lucas3133/atlas-rate-limiter/discussions)
- 🐛 [Issue Tracker](https://github.com/Lucas3133/atlas-rate-limiter/issues)

### Stay Updated

- ⭐ Star the repository
- 👀 Watch for releases
- 🐦 Follow updates

---

## 🙏 Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Project documentation

---

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Atlas Rate Limiter! 🛡️💜
