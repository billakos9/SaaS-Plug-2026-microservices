FROM nginx:alpine
# nginx path configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf
# listens on port 80
EXPOSE 80
# keep running in the background, after containers start proccess
CMD ["nginx", "-g", "daemon off;"]