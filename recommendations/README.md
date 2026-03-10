# OmniLearn LightFM Recommendation Service

Hybrid collaborative filtering for content recommendations using the [LightFM](https://github.com/lyst/lightfm) library.

## Setup

```bash
cd recommendations
pip install -r requirements.txt
```

## Configuration

| Env var | Description |
|---------|-------------|
| `OMNILEARN_API_URL` | Backend API URL (default: http://localhost:4000) |
| `MODEL_PATH` | Path to persist trained model (default: ./data/model.pkl) |

## Run

```bash
uvicorn main:app --reload --port 5000
```

## Endpoints

- `GET /health` — Service health and model status
- `POST /train` — Fetch interactions from API and train/retrain model
- `GET /recommend/{user_id}?limit=10&exclude=id1,id2` — Get recommendations for a user

## Integration

1. Set `LIGHTFM_SERVICE_URL=http://localhost:5000` in `backend/.env`
2. Run `POST /train` periodically (e.g. cron) or after significant new interactions
3. The NestJS intelligence service will call this for `GET /intelligence/recommendations?userId=...`

## Data sources

Interactions are built from:
- Analytics events (content views, enrollments, completions)
- Path step progress (completed steps)
- Course reviews (ratings)
- Microlearning likes
- Path enrollments (mapped to content)

User features: department, position, industry, sectorFocus  
Item features: type, domainId, sectorTag
