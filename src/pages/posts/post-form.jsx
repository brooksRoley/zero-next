import React, { useState } from 'react';
import Layout from '../../components/layout';

const PostForm = ({ onPost }) => {
  const [content, setContent] = useState('');

  const handleContentChange = (event) => {
    setContent(event.target.value);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    // Create a new post object
    const newPost = {
      content,
      timestamp: new Date().toISOString(),
    };

    // Call the onPost callback to send the new post data to the parent component
    onPost(newPost);

    // Clear the input field after posting
    setContent('');
  };

  return (
    <Layout>
      <h2>Create a New Post</h2>
      <form onSubmit={handleSubmit}>
        <textarea
          value={content}
          onChange={handleContentChange}
          placeholder="Write your post here..."
          rows={4}
          cols={50}
        />
        <br />
        <button type="submit">Post</button>
      </form>
    </Layout>
  );
};

export default PostForm;
