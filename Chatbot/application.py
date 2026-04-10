# Elastic Beanstalk entry point
# This file is used by AWS Elastic Beanstalk to run the application

from main import app

# Elastic Beanstalk expects 'application' variable
application = app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(application, host="0.0.0.0", port=8000)

