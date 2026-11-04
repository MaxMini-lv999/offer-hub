# 在 backend/src/（go.mod 所在目录）下执行：make fmt / make vet / make pre-commit
.PHONY: fmt vet pre-commit

fmt:
	go fmt ./...

vet:
	go vet ./...

# 提交前检查：先格式化再静态检查
pre-commit: fmt vet
