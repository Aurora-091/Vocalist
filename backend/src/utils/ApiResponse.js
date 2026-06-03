function success(res, data, statusCode = 200, message = undefined) {
  const payload = { success: true };
  if (message !== undefined) payload.message = message;
  if (data !== undefined) payload.data = data;
  return res.status(statusCode).json(payload);
}

function created(res, data, message = undefined) {
  return success(res, data, 201, message);
}

function noContent(res) {
  return res.status(204).send();
}

module.exports = { success, created, noContent };
