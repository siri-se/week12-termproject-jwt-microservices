FROM nginx:alpine

# ลบ config เดิม
RUN rm /etc/nginx/conf.d/default.conf

# Copy config ใหม่
COPY nginx.conf /etc/nginx/conf.d/default.conf

# รอ services ก่อน start
EXPOSE 80