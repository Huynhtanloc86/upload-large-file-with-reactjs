import React, { useState, useEffect } from "react";
import axios from "axios";
import { Upload, Progress } from "antd";
import { InboxOutlined } from "@ant-design/icons";

axios.defaults.baseURL = "http://localhost:4001";
const chunkSize = 1024 * 1024 * 5; //5MB section size, increase the number measure in mb

function App() {
  const [fileChunks, setFileChunks] = useState(null);
  const [fileGuid, setFileGuid] = useState("");
  const [chunkCount, setChunkCount] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const [progress, setProgress] = useState(0);
  const [counter, setCounter] = useState(0);

  useEffect(() => {
    if (fileChunks) {
      uploadChunks(fileChunks);
      setShowProgress(true);
    }
  }, [fileChunks]);

  const uploadFileHandler = ({ file }) => {
    resetChunkProperties();
    let index = 0; // Section num
    let saveChunks = [];
    for (let cur = 0; cur < file.size; cur += chunkSize) {
      saveChunks.push({
        hash: index++,
        chunk: file.slice(cur, cur + chunkSize),
        name: file.name,
      });
    }
    setFileChunks(saveChunks);
    setFileGuid(file.name);
    setChunkCount(saveChunks.length);
  };

  console.log(fileChunks);
  const uploadChunks = async (list = []) => {
    let pool = []; //Concurrent pool
    let max = 10; //Maximum concurrency
    let finish = 0; //Quantity completed
    let failList = []; //A list of failures
    for (let i = 0; i < list.length; i++) {
      let item = list[i];
      let formData = new FormData();
      formData.append("filename", item.name);
      formData.append("hash", item.hash);
      formData.append("chunk", item.chunk);

      // Upload section
      let task = axios({
        method: "post",
        url: "/upload",
        data: formData,
      });
      task
        .then(({ data }) => {
          if (data.isSuccess) {
            setCounter(counter + 1);
            console.log(counter);
            console.log("hello");
          }
          console.log(data);
          //Remove the Promise task from the concurrency pool when the request ends
          let index = pool.findIndex((t) => t === task);
          pool.splice(index);
        })
        .catch(() => {
          failList.push(item);
        })
        .finally(() => {
          finish++;
          //All requests are requested complete
          if (finish === list.length) {
            uploadChunks(failList);
          }
        });
      pool.push(task);
      if (pool.length === max) {
        //Each time the concurrent pool finishes running a task, another task is plugged in
        await Promise.race(pool);
      }
    }

    if (list.length === 0) {
      //All tasks complete, merge slices
      mergeRequest(fileGuid);
    }
  };

  // notify server to merge chunks
  const mergeRequest = async (fileGuid) => {
    await axios({
      method: "get",
      url: "/merge",
      params: {
        filename: fileGuid,
      },
    }).then((data) => {
      if (data.isSuccess) {
        setProgress(100);
      }
    });
  };

  const resetChunkProperties = () => {
    setShowProgress(true);
    setProgress(0);
    setCounter(1);
    setFileChunks(null);
    setChunkCount(0);
    setFileGuid(null);
  };

  return (
    <div className="App">
      <div className="wrap">
        <Upload.Dragger
          accept=".csv"
          customRequest={uploadFileHandler}
          showUploadList={false}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">
            Click or drag file to this area to upload
          </p>
          <p className="ant-upload-hint">
            Support for a single or bulk upload. Strictly prohibit from
            uploading company data or other band files
          </p>
        </Upload.Dragger>
        {showProgress && <Progress percent={progress} />}
      </div>
    </div>
  );
}

export default App;
