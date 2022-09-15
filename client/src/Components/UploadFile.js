import React, { useState, useCallback } from "react";
import axios from "axios";
import { Upload, Progress, Space, Button, message } from "antd";
import { InboxOutlined, UploadOutlined } from "@ant-design/icons";

axios.defaults.baseURL = "http://localhost:4001";
const chunkSize = 1024 * 1024 * 10; //10MB section size, increase the number measure in mb

function UploadFile() {
  const [fileChunkList, setFileChunkList] = useState([]);
  const [fileChunkTotal, setFileChunkTotal] = useState(0);
  const [fileGuid, setFileGuid] = useState("");
  const [fileSize, setFileSize] = useState(0);

  const [showProgress, setShowProgress] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failChunkList, setFailChunkList] = useState([]);

  // Generate a file slices
  const createFileChunkHandler = ({ file }) => {
    let index = 0; // Section num
    let fileChunks = [];
    for (let cur = 0; cur < file.size; cur += chunkSize) {
      fileChunks.push({
        hash: index++,
        chunk: file.slice(cur, cur + chunkSize),
        name: file.name,
      });
    }
    // Save info file on state of component
    setFileChunkList(fileChunks);
    setFileChunkTotal(fileChunks.length);
    setFileGuid(file.name);
    setFileSize(file.size);
  };

  // start upload file chunks
  const startUploadChunks = useCallback(() => {
    uploadChunksHandler(fileChunkList);
    setShowProgress(true);
  }, [fileChunkList]);

  // Resumable the failure list
  const uploadResume = () => {
    uploadChunksHandler(failChunkList);
  };

  const uploadChunksHandler = async (fileChunkList) => {
    let pool = []; //Concurrent pool
    let max = 10; //Maximum concurrency
    let finish = 0; //Quantity completed
    let failList = []; //A list of failures

    for (let i = 0; i < fileChunkList.length; i++) {
      let item = fileChunkList[i];
      let formData = new FormData();
      formData.append("filename", item.name);
      formData.append("hash", item.hash);
      formData.append("chunk", item.chunk);

      // Upload section
      let task = axios({
        method: "post",
        url: "/upload",
        data: formData,
        onUploadProgress: (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            const totalPercentComplete = Math.round(
              (finish / fileChunkTotal) * 100 + percentComplete / fileChunkTotal
            );
            setProgress(totalPercentComplete + progress);
          }
        },
      })
        .then(({ data }) => {
          if (data.isSuccess) console.log("Upload chunk successful");
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
          if (finish === fileChunkList.length && failList.length === 0) {
            mergeRequestChunks(fileGuid);
          }
        });
      pool.push(task);
      if (pool.length === max) {
        //Each time the concurrent pool finishes running a task, another task is plugged in
        await Promise.race(pool);
      }
      // save fail file chucks
      if (failList.length > 0) {
        setFailChunkList(failList);
      }
    }
  };
  //
  // // notify server to merge chunks
  const mergeRequestChunks = async (fileGuid) => {
    await axios({
      method: "get",
      url: "/merge",
      params: {
        filename: fileGuid,
      },
    }).then(({ data }) => {
      if (data.isSuccess) {
        message.success("Upload successful");
        setTimeout(() => {
          resetChunkProperties();
        }, 100);
      }
    });
  };

  const resetChunkProperties = () => {
    setFileChunkList([]);
    setFileSize(0);
    setFileChunkTotal(0);
    setFileGuid("");
    setShowProgress(false);
    setProgress(0);
    setFailChunkList([]);
  };

  return (
    <>
      <Upload.Dragger
        customRequest={createFileChunkHandler}
        showUploadList={false}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">
          Click or drag file to this area to upload
        </p>
        {fileSize > 0 && (
          <p className="ant-upload-hint">
            Upload file size: {Math.floor(fileSize / (1024 * 1024))} MB
          </p>
        )}
        {fileChunkTotal > 0 && (
          <p className="ant-upload-hint">
            There will be {fileChunkTotal} chunks to uploaded
          </p>
        )}
      </Upload.Dragger>
      {showProgress && <Progress percent={progress} />}

      <Space style={{ textAlign: "center", marginTop: 10 }} align="end">
        <Button
          icon={<UploadOutlined />}
          disabled={!fileChunkList.length > 0 || failChunkList.length > 0}
          onClick={startUploadChunks}
        >
          Star Upload
        </Button>
        {failChunkList.length > 0 && (
          <Button onClick={uploadResume}>ReUpload</Button>
        )}
      </Space>
    </>
  );
}

export default UploadFile;
