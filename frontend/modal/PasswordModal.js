import { FormGroup, Input, Modal } from "@goorm-dev/vapor-components";
import { Button, Card } from "@goorm-dev/vapor-core";
import { useState } from "react";

const PasswordModal = ({ isOpen, onClose, onSubmit }) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setError("비밀번호를 입력해주세요.");
      return;
    }
    onSubmit(password);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <Card.Header>비밀번호 입력</Card.Header>
      <form onSubmit={handleSubmit}>
        <Card.Body>
          <FormGroup>
            <Input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              placeholder="비밀번호를 입력하세요"
              autoFocus
            />
            {error && <FormFeedback>{error}</FormFeedback>}
          </FormGroup>
        </Card.Body>
        <Card.Footer>
          <Button type="submit" color="primary">
            확인
          </Button>
          <Button type="button" color="secondary" onClick={onClose}>
            취소
          </Button>
        </Card.Footer>
      </form>
    </Modal>
  );
};
export default PasswordModal;
